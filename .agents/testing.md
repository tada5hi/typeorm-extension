# Testing

## Setup

- **Runner**: Vitest 4 with **[`unplugin-swc`](https://github.com/unplugin/unplugin-swc)** for TypeScript transformation (needed because TypeORM decorators require `emitDecoratorMetadata`, which vitest's default `oxc` transformer does not emit). The config sets `oxc: false` to keep oxc from running in parallel with swc.
- **Test location**: `test/unit/**/*.{test,spec}.{js,ts}` (default suite) and `test/integration/**/*.{test,spec}.{js,ts}` (driver suite).
- **Config**: `test/vitest.config.ts` — sets `root` to repo root, enables `globals: true` (so test files don't need to `import { describe, it, expect } from 'vitest'`), and registers `test/vitest.setup.ts` via `setupFiles`. The setup file calls `setModuleLoader({ load: (id) => import(id) })` from `locter` so dynamic imports inside `locter.load()` are rewritten by vitest's transformer and go through vitest's module graph instead of native Node — without this, dynamically-loaded seeder / data-source / factory files don't share entity classes with the test module, breaking TypeORM repository lookups. (`setModuleLoader` was added in `locter@3` and supersedes the older `server.deps.inline: [/locter/]` workaround.) `test/vitest.integration.config.ts` mirrors it for the driver suite (no coverage, `fileParallelism: false`, 60s timeouts).
- **Prerequisite**: nothing external for `npm test` — the default suite uses `better-sqlite3` databases (in-memory for unit work; file-backed under `writable/` for the seeder lifecycle tests). `npm run test:integration` needs a real server.

## Running Tests

```bash
npm test                                                              # default suite
npx vitest --config test/vitest.config.ts --run test/unit/seeder       # one folder
npm run test:coverage                                                 # with coverage (thresholds enforced)
npm run test:integration                                              # driver suite (see below)
```

There are no workspace-scoped commands — this is a single package.

### Driver suite (`test/integration/`)

Covers what sqlite and the fakes structurally can not: dialect-asymmetric DDL, the native client adapters, and how a real server reports its own schema back. Configured through the **same env variables the library reads** (`TYPEORM_CONNECTION`, `TYPEORM_HOST`, `TYPEORM_PORT`, `TYPEORM_USERNAME`, `TYPEORM_PASSWORD`, `TYPEORM_DATABASE`); every suite is wrapped in `describe.runIf(...)`, so without `TYPEORM_CONNECTION` the run is a clean skip rather than a failure. Supported values: `postgres`, `cockroachdb`, `mysql`, `mariadb`, `mssql`, `oracle`, `mongodb`.

Not every driver can do everything, so `test/data/typeorm/integration.ts` exposes capability predicates instead of hard-coding driver names in the specs — extend those rather than adding `if (driver === …)` to a spec:

| Predicate                        | False for                | Because                                                                                  |
|----------------------------------|--------------------------|------------------------------------------------------------------------------------------|
| `supportsSchemaAlter`            | mssql, oracle, mongodb   | the rename helpers have no statements for them (they assert a `DriverError` instead)       |
| `supportsForeignKeyChecks`       | everything but mysql/mariadb | no session-level switch                                                                |
| `supportsForeignKeyColumnAlter`  | everything but mysql     | mariadb refuses to alter either end of a constraint (error 1832/1833), whatever the checks or the algorithm |
| `supportsSchemaMetadata`         | mongodb                  | no relational schema to compare, and the fixtures use relations                            |
| `supportsDatabaseDrop`           | oracle                   | `OracleDialect.drop` is a documented no-op                                                 |
| `supportsDatabaseExistenceCheck` | cockroachdb, mongodb     | `checkDatabase` derives `exists` from a failing `initialize()`, which cockroachdb does not do for a missing database |

```bash
docker run -d --name tex-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 55432:5432 postgres:18-alpine

TYPEORM_CONNECTION=postgres TYPEORM_HOST=127.0.0.1 TYPEORM_PORT=55432 \
TYPEORM_USERNAME=test TYPEORM_PASSWORD=test TYPEORM_DATABASE=test \
npm run test:integration
```

| Suite                                    | Covers                                                                                     |
|------------------------------------------|--------------------------------------------------------------------------------------------|
| `test/integration/database/drift.spec.ts`   | `getSchemaDrift` / `assertSchemaMatchesMetadata` against a real schema, including a deliberately diverged column |
| `test/integration/database/schema.spec.ts`  | `renameIndex` / `renameForeignKey` / `changeColumnType` round-trips incl. idempotence and "drift appears → repair → drift gone"; that a column keeps its values and its foreign key across an alteration; nesting-safe `withForeignKeyChecksDisabled` |
| `test/integration/database/methods.spec.ts` | `createDatabase` / `dropDatabase` / `checkDatabase` — the only coverage `src/database/adapters/**` gets, since it is excluded from the coverage gate |

The suites bring the schema to a known state by dropping the two fixture tables and running `synchronize(false)` — **not** `synchronize(true)`, which drops the whole schema and which oracle refuses from within a pluggable database (`ORA-65040`).

In CI a `Test (<driver>)` matrix job (`main.yml`) runs the suite against one service container per driver. Because each image ignores the env variables meant for the others, a single `services.database.env` block serves all of them; only image, port, credentials, health command and (for oracle) the retry count come from the matrix.

Write assertions in terms the *driver* agrees with, not in terms of one dialect's spelling: `text` is not a type oracle has, `character varying` is what postgres calls a `varchar`, and cockroachdb reports `text` back as `string`. Changing a column's **length** is the one alteration every driver expresses the same way.

**Be careful with assumptions about server behaviour** — write the assertion against the *end state*, not against the statements you expect the server to need. Example: mysql 8/9 and mariadb 11 rename the index they reuse for a re-added foreign key by themselves, so an assertion that "the extra RENAME INDEX statement must have run" would pass for the wrong reason; asserting "the table carries no stale index" holds on every version.

## Test Layers

### Unit + integration in one suite

The default suite under `test/unit/` doesn't separate unit from integration tests: most of its suites instantiate a real `DataSource` (against `better-sqlite3 :memory:`) rather than mocking TypeORM. What lives in `test/integration/` instead is everything that needs a *real database server* — see the driver suite above. Example: `test/unit/database/index.spec.ts` actually calls `buildDataSourceOptions` and `checkDatabase` end-to-end.

### Suites by domain (mirroring `src/`)

| Folder                   | Tests                                                                |
|--------------------------|----------------------------------------------------------------------|
| `test/unit/data-source/` | `findDataSource`, options building, singleton registry behavior      |
| `test/unit/database/`    | `checkDatabase`, migration helpers (against in-memory sqlite)        |

`test/unit/database/migration.spec.ts` is the one suite which writes files: `generateMigration` emits into `writable/migrations` (removed again in `afterEach`), and the generated file is then imported and its `up()` / `down()` run against a fresh sqlite data source. Asserting the file content alone would not notice a template which does not parse. The package is ESM, so the CommonJS variant only loads when the same content is written a second time under a `.cjs` extension, and `module.exports = class` arrives as the class itself rather than as a module namespace.

| `test/unit/database/schema/` | `synchronizeDatabaseSchema`, drift detection, the guarded alter helpers (pure statement builders + `FakeQueryRunner`) |
| `test/unit/env/`         | `useEnv()` env-var reading + `resetEnv()` cache invalidation         |
| `test/unit/helpers/`     | Entity helpers (name, metadata, join columns, property names, uniqueness) |
| `test/unit/runtime/`     | `AsyncKeyedCache` semantics, `RuntimeRegistry` state + `reset()`     |
| `test/unit/seeder/`      | Seeder execution, tracking, factory manager                          |
| `test/unit/utils/`       | Pure helper functions                                                |

## Test Helpers & Fixtures

`test/data/` is a small shared fixture project that looks like a real consumer of the library:

- **`test/data/entity/`** — `User`, `Role` TypeORM entities with a many-to-one relation. `Account` (column names differing from property names, composite unique key) and `Tenant` / `Membership` (composite primary key referenced by a composite foreign key) exist for the entity helpers: the naming and composite-key paths are invisible on `User` / `Role`, where property and column names coincide.
- **`test/data/factory/`** — Faker factories that produce `User` and `Role` instances.
- **`test/data/seed/`** — Seeders that exercise `factoryManager` and persist to the DB.
- **`test/data/typeorm/`**
  - `factory.ts` → `createDataSourceOptions()` + `createDataSource()`. **Always use these** instead of building a DataSource by hand in a test.
  - `data-source.ts` / `data-source-default.ts` / `data-source-async.ts` → fixtures for `findDataSource` discovery tests (different export shapes: named, default, async).
  - `FakeQueryRunner.ts` → recording stand-in for the schema-inspection/alteration surface of a `QueryRunner` (`getTable`, `query`, `changeColumn`). Its `respond(query, runner)` callback can mutate the loaded tables in reaction to a statement, which is how the mysql "backing index appears only after the constraint is dropped" flow is simulated. Pair it with `table.ts` (`createTable`, `TABLE_FOREIGN_KEYS`) for the loaded-table fixtures.
  - `integration.ts` → `useIntegrationDriver()` + `createIntegrationDataSourceOptions()` for the driver suite.
  - `ormconfig.json` → fixture for legacy config discovery paths.
  - `tsconfig.json` → consumed by tests that exercise `readTSConfig` + the path resolver.
- **`test/data/database/`** — in-memory implementations of the database connection layer:
  - `MemoryDatabaseConnectionFactory` → recording connection factory (events: open/execute/close, open-connection tracking, pluggable respond callback to simulate server state). Assert `connectionFactory.statements()` and lifecycle ordering instead of touching a real server.
  - `MemoryFileSystem` → same idea for the filesystem effects (better-sqlite3). The mongo dialect uses `MemoryDatabaseConnectionFactory` too — its statements are JSON encoded command documents.
  - Connection factories are injected via the dialect constructor (`new PostgresDialect(new MemoryDatabaseConnectionFactory())`); end-to-end specs pass `DatabaseDialectOverrides` to `executeDatabaseCreate` / `executeDatabaseDrop`.

## Testing Philosophy

Tests should assert *expected* behavior based on the documented API contracts (CLI options, database create/drop semantics, seeder tracking semantics) — not merely confirm what the implementation currently does. If a test fails after a refactor, first consider whether the test caught a real regression in user-visible behavior.

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
// Good — recording connection factory for database create/drop tests
import { MemoryDatabaseConnectionFactory } from '../../data/database';

const connectionFactory = new MemoryDatabaseConnectionFactory();
const dialect = new PostgresDialect(connectionFactory);
await dialect.create({ params: { database: 'app' }, ifNotExist: false, initialDatabase: 'postgres' });
expect(connectionFactory.statements()).toEqual(['CREATE DATABASE "app"']);
```

```ts
// Avoid — hand-rolled jest.fn() stubs of TypeORM internals.
// They drift from real behavior and tend to mask bugs.
const runner = { query: jest.fn(), release: jest.fn() } as any;
```

After mutating `process.env` in a test, call `resetEnv()` from `src/env` to clear the cached `Environment` instance, otherwise the next test sees stale values. For a full process-state teardown (data sources, options, env, factories at once), call `useRuntimeRegistry().reset()` from `src/runtime` (internal module — import it by path in tests).

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

`coverage.exclude` (in `test/vitest.config.ts`) **excludes** `src/cli/**`, `src/database/adapters/**`, `src/database/driver/**` (deprecated delegates), `src/env/utils.ts`, and `src/errors/**` from coverage scoring — the gate covers `src/data-source/**`, `src/helpers/**`, `src/seeder/**`, `src/utils/**`, and the database layer (`core/`, `registry.ts`, `methods/`, `utils/`). Be aware: a change inside the excluded folders won't be caught by the threshold, so write tests proactively for those.

The `tests` job in `main.yml` runs `npm run test:coverage` and uploads the report to Codecov via `codecov/codecov-action` on every push / PR. Coverage runs there (not in `release.yml`) so it executes under the pinned Node version: the `tada5hi/monoship` publish step in `release.yml` re-inits the runner to Node 22 via its own `setup-node`, which would leave the native `better-sqlite3` binary (built for the install-step Node) ABI-mismatched for any test step that ran after it.

## Infrastructure

None required for `npm test` — the default suite uses `better-sqlite3 :memory:`. `npm run test:integration` needs a server for the configured driver; the images CI uses are listed in the `integration` matrix of `main.yml` and work as plain `docker run` invocations locally.

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`):

```
install → build → (lint || tests+coverage-upload || integration × {postgres, cockroachdb, mysql, mariadb, mssql, mongodb, oracle})
```

All jobs use a single Node version (`PRIMARY_NODE_VERSION = 24`); there is no matrix across Node versions. The `tests` job runs `npm run test:coverage` and uploads to Codecov. The `integration` matrix job runs `npm run test:integration` against one service container per driver (`fail-fast: false`, so a mysql-only failure still reports postgres). `release.yml` handles `release-please` PRs + npm publish + docs deploy (no coverage — see above). The install action's cache key includes the Node version so a native binary built for one Node ABI is never restored for another.

## Writing New Tests

1. Place test files under `test/unit/<domain>/` with the `.spec.ts` extension. Mirror the `src/` folder name.
2. For anything that touches a `DataSource`, use `createDataSource()` / `createDataSourceOptions()` from `test/data/typeorm/factory.ts`. Don't redeclare options inline.
3. If the test mutates `process.env`, call `resetEnv()` from `src/env` in `afterEach`.
4. Always `await dataSource.destroy()` (or use a `finally` block) — sqlite leaks are silent but trip the next test.
5. If the behaviour is dialect-specific (DDL syntax, native client, how the server reports its schema), add a `test/integration/` case as well — the default suite can only prove the statement that *would* be sent, not that the server accepts it.
6. Run `npm test` then `npm run lint` before committing.
