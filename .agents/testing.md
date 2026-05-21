# Testing

## Setup

- **Runner**: Vitest 4 with **[`unplugin-swc`](https://github.com/unplugin/unplugin-swc)** for TypeScript transformation (needed because TypeORM decorators require `emitDecoratorMetadata`, which vitest's default `oxc` transformer does not emit). The config sets `oxc: false` to keep oxc from running in parallel with swc.
- **Test location**: `test/unit/**/*.{test,spec}.{js,ts}`
- **Config**: `test/vitest.config.ts` — sets `root` to repo root, enables `globals: true` (so test files don't need to `import { describe, it, expect } from 'vitest'`), and registers `test/vitest.setup.ts` via `setupFiles`. The setup file calls `setModuleLoader({ load: (id) => import(id) })` from `locter` so dynamic imports inside `locter.load()` are rewritten by vitest's transformer and go through vitest's module graph instead of native Node — without this, dynamically-loaded seeder / data-source / factory files don't share entity classes with the test module, breaking TypeORM repository lookups. (`setModuleLoader` was added in `locter@3` and supersedes the older `server.deps.inline: [/locter/]` workaround.)
- **Prerequisite**: nothing external. All integration tests use `better-sqlite3` databases (in-memory for unit work; file-backed under `writable/` for the seeder lifecycle tests).

## Running Tests

```bash
npm test                                                              # all suites
npx vitest --config test/vitest.config.ts --run test/unit/query        # one folder
npm run test:coverage                                                 # with coverage (thresholds enforced)
```

There are no workspace-scoped commands — this is a single package.

## Test Layers

### Unit + integration in one suite

The codebase doesn't separate unit and integration tests. Everything lives under `test/unit/`, and most suites instantiate a real `DataSource` (against `better-sqlite3 :memory:`) rather than mocking TypeORM. Example: `test/unit/database/index.spec.ts` actually calls `buildDataSourceOptions` and `checkDatabase` end-to-end.

The handful of cases that *do* avoid the real ORM (pure query-builder transforms) use `test/data/typeorm/FakeSelectQueryBuilder.ts` — a hand-rolled minimal stand-in. Use it rather than reaching for `jest.fn()` mocks.

### Suites by domain (mirroring `src/`)

| Folder                   | Tests                                                                |
|--------------------------|----------------------------------------------------------------------|
| `test/unit/data-source/` | `findDataSource`, options building, singleton registry behavior      |
| `test/unit/database/`    | `checkDatabase`, migration helpers (against in-memory sqlite)        |
| `test/unit/env/`         | `useEnv()` env-var reading + `resetEnv()` cache invalidation         |
| `test/unit/helper/`      | Entity inspection helpers (join columns, property names, uniqueness) |
| `test/unit/query/`       | `applyQuery` end-to-end and per-parameter (fields/filters/…)         |
| `test/unit/seeder/`      | Seeder execution, tracking, factory manager                          |
| `test/unit/utils/`       | Pure helper functions                                                |

## Test Helpers & Fixtures

`test/data/` is a small shared fixture project that looks like a real consumer of the library:

- **`test/data/entity/`** — `User`, `Role` TypeORM entities with a many-to-one relation.
- **`test/data/factory/`** — Faker factories that produce `User` and `Role` instances.
- **`test/data/seed/`** — Seeders that exercise `factoryManager` and persist to the DB.
- **`test/data/typeorm/`**
  - `factory.ts` → `createDataSourceOptions()` + `createDataSource()`. **Always use these** instead of building a DataSource by hand in a test.
  - `data-source.ts` / `data-source-default.ts` / `data-source-async.ts` → fixtures for `findDataSource` discovery tests (different export shapes: named, default, async).
  - `FakeSelectQueryBuilder.ts` → in-memory query-builder fake; use when asserting that `applyQuery*` makes the right calls without spinning up sqlite.
  - `ormconfig.json` → fixture for legacy config discovery paths.
  - `tsconfig.json` → consumed by tests that exercise `readTSConfig` + `adjustFilePath`.

## Testing Philosophy

Tests should assert *expected* behavior based on the documented API contracts (CLI options, `applyQuery` shape, seeder tracking semantics) — not merely confirm what the implementation currently does. If a test fails after a refactor, first consider whether the test caught a real regression in user-visible behavior.

### Prefer fakes / real in-memory DBs over `jest.fn()` mocks

The codebase already provides the building blocks:

```ts
// Good — real DataSource against in-memory sqlite, fast and realistic
import { createDataSource } from '../../data/typeorm/factory';

const dataSource = createDataSource();
await dataSource.initialize();
// …exercise the real public API…
await dataSource.destroy();
```

```ts
// Good — query-builder fake for pure transformation tests
import { FakeSelectQueryBuilder } from '../../data/typeorm/FakeSelectQueryBuilder';

const qb = new FakeSelectQueryBuilder();
applyQueryFiltersParseOutput(qb as any, parsed, opts);
expect(qb.calls).toEqual([...]);
```

```ts
// Avoid — hand-rolled jest.fn() stubs of TypeORM internals.
// They drift from real behavior and tend to mask bugs.
const qb = { where: jest.fn(), leftJoin: jest.fn() } as any;
```

After mutating `process.env` in a test, call `resetEnv()` from `src/env` to clear the cached `Environment` instance, otherwise the next test sees stale values.

Test files that need a directory reference must use `import.meta.dirname` (Node 22+) — `__dirname` is not available because the package is ESM-only.

## Code Coverage

```bash
npm run test:coverage
```

Thresholds (enforced — Vitest fails the run below these):

| Metric     | Target |
|------------|--------|
| branches   | 80%    |
| functions  | 80%    |
| lines      | 80%    |
| statements | 80%    |

`coverage.exclude` (in `test/vitest.config.ts`) **excludes** `src/cli/**`, `src/database/**`, `src/env/utils.ts`, `src/errors/**`, `src/utils/**`, and `src/seeder/**` from coverage scoring — the gate effectively covers `src/data-source/**`, `src/helpers/**`, and `src/query/**`. Be aware: a change inside the excluded folders won't be caught by the threshold, so write tests proactively for those.

Coverage is uploaded by CI to Codecov via `codecov/codecov-action`.

## Infrastructure

None required for local runs — every test uses `better-sqlite3 :memory:`. The library itself supports Postgres/MySQL/Mongo/MSSQL/Oracle/CockroachDB, but the test suite does not spin up those engines.

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`):

```
install → build → (lint || tests)
```

All jobs use a single Node version (`PRIMARY_NODE_VERSION = 22`). There is no matrix across databases or Node versions. `release.yml` handles `release-please` PRs.

## Writing New Tests

1. Place test files under `test/unit/<domain>/` with the `.spec.ts` extension. Mirror the `src/` folder name.
2. For anything that touches a `DataSource`, use `createDataSource()` / `createDataSourceOptions()` from `test/data/typeorm/factory.ts`. Don't redeclare options inline.
3. If the test mutates `process.env`, call `resetEnv()` from `src/env` in `afterEach`.
4. Always `await dataSource.destroy()` (or use a `finally` block) — sqlite leaks are silent but trip the next test.
5. Run `npm test` then `npm run lint` before committing.
