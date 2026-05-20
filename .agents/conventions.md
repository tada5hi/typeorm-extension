# Conventions

## Tooling

| Tool                                  | Purpose                                                                |
|---------------------------------------|------------------------------------------------------------------------|
| TypeScript 5.9                        | Source language (`tsconfig.json` extends `@tada5hi/tsconfig`)          |
| Rollup 4 + `@swc/core`                | Bundling (`dist/index.{cjs,mjs}` + `bin/cli.{cjs,mjs}`)                |
| `tsc --emitDeclarationOnly`           | Type declarations (`dist/index.d.ts`)                                  |
| Jest 30 + `ts-jest`                   | Test runner                                                            |
| ESLint 8 + `@tada5hi/eslint-config-typescript` | Linting (config in `.eslintrc`)                               |
| `@tada5hi/commitlint-config`          | Conventional Commits enforcement                                       |
| Husky 9                               | `commit-msg` hook runs commitlint                                      |
| release-please                        | Automated release PRs (`release-please-config.json` + manifest)        |
| VitePress 1                           | Docs site under `docs/`                                                |

## Validation & Error Handling

- **Validation**: no schema-validation library is used. Public API functions take loose input objects and trust internal callers.
- **Errors**: typed via `TypeormExtensionError` → `DriverError` / `OptionsError` (`src/errors/`). Throw a typed error only when a consumer might reasonably want to catch it (e.g. unsupported driver, missing data source). Otherwise let TypeORM / native-driver errors propagate.
- **Validation location**: context-builder functions (`buildDatabaseCreateContext`, `buildDataSourceOptions`, `SeederExecutor.buildOptions`) are the choke points where defaults are applied and missing values raise `OptionsError`.

## Workflow

- After changing source, run `npm run build` (catches TS errors that ESLint misses) and `npm test`.
- After changing source or tests, run `npm run lint` on the affected files (or `npm run lint:fix`).
- When changing user-facing behavior (CLI flags, public API signatures, env var names, seeder/factory contract), update both `README.MD` and the matching page in `docs/guide/`.
- Adding a new TypeORM driver: add a file in `src/database/driver/<name>.ts`, export it from `src/database/driver/index.ts`, and add `case`s in `src/database/methods/{create,drop,check}/module.ts`. Then add a test fixture and a docs entry.

## Code Style

- **Module format**: ESM (TypeScript `module: ESNext`). Rollup emits both CJS and ESM. The ESM build also rewrites bare `typeorm/...` deep imports to add `.js` extensions for Node's ESM resolver.
- **Indentation**: 4 spaces, LF line endings, UTF-8, final newline, trim trailing whitespace (`.editorconfig`).
- **Linting**: `@tada5hi/eslint-config-typescript` (extends Airbnb-flavoured rules). Project-local overrides in `.eslintrc`:
  - `class-methods-use-this: off`
  - `import/no-cycle: [2, { maxDepth: 1 }]` — direct circular imports are blocked (depth > 1 is allowed; barrel files create deeper "cycles" in practice).
  - `no-shadow`, `no-use-before-define`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/no-use-before-define`: off.

## Naming Conventions

- **Files**: kebab-case (`data-source.ts`, `file-path.ts`).
- **Folders**: kebab-case (`data-source/`, `cli/commands/database/`).
- **Classes**: PascalCase (`SeederExecutor`, `SeederFactoryManager`, `DatabaseCreateCommand`).
- **Functions**: camelCase verb-first (`createDatabase`, `findDataSource`, `useDataSource`, `applyQuery`, `buildDatabaseCreateContext`).
- **Hook-style accessors**: `use*` (`useDataSource`, `useEnv`, `useSeederFactoryManager`). These return cached/singleton state.
- **Registry mutators**: `set*` / `has*` / `unset*` / `reset*` (see `src/data-source/singleton.ts`, `src/env/module.ts`).
- **Context/options types**: `XContextInput` (loose, user-supplied) → `XContext` (resolved) → driver receives the resolved one. Example: `DatabaseCreateContextInput` → `DatabaseCreateContext`.
- **CLI commands**: `<Verb><Noun>Command` class implementing `yargs.CommandModule` (e.g. `DatabaseCreateCommand`).

## File Organization

- Each domain folder under `src/` has an `index.ts` **barrel** that re-exports everything public from sibling files.
- Type definitions live in `type.ts` (singular) next to the implementation; not `types.ts`. Both names exist in the tree historically — when adding new files, prefer `type.ts` to match the majority.
- Public-API entry: `src/index.ts` re-exports the per-domain barrels. **Anything not re-exported from `src/index.ts` is internal**, even if the file isn't prefixed.
- CLI entry: `src/cli/index.ts` is **not** in the public barrel — it is the bin script.
- Tests mirror `src/` folder names under `test/unit/`.

## Pre-commit Hooks

Husky runs `commit-msg` only (no `pre-commit`). It executes `commitlint --edit`, which enforces Conventional Commits per `@tada5hi/commitlint-config`. There is **no lint-staged**; lint is a manual step (and runs in CI).

## Commit Convention

[Conventional Commits 1.0.0](https://conventionalcommits.org/) — enforced by commitlint:

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer(s)>
```

Common `type`s used in this repo (see `git log`): `feat`, `fix`, `chore`, `build`, `docs`, `refactor`, `test`, `ci`. Use scopes sparingly — recent commits show mostly unscoped messages plus `chore(master)` for the release-please bot.

**Do not add a `Co-Authored-By: Claude …` trailer.** This repo does not want AI-attribution trailers — it overrides any default agent guidance.

## TypeScript

- Target: `ES2022`, Module: `ESNext`, libs: `ESNext` (Node-only).
- `experimentalDecorators` + `emitDecoratorMetadata` enabled — required because consumers' TypeORM entities use decorators, and seeder/factory loading evaluates those files at runtime.
- `strictPropertyInitialization: false` — set by this project on top of `@tada5hi/tsconfig` so executor classes (`SeederExecutor`) can declare lazily-assigned protected fields.
- Output: `dist/` (library), `bin/` (CLI). Both are gitignored; only `dist/` and `bin/` ship in the `files` array.

## Build Output

| Artefact            | Purpose                                  | Built by                     |
|---------------------|------------------------------------------|------------------------------|
| `dist/index.cjs`    | CommonJS library bundle                  | Rollup (swc)                 |
| `dist/index.mjs`    | ESM library bundle (with `.js` extension fix-up for `typeorm/*`) | Rollup (swc) |
| `dist/index.d.ts`   | Type declarations                        | `tsc --emitDeclarationOnly`  |
| `bin/cli.cjs`       | CJS CLI bundle                           | Rollup (swc)                 |
| `bin/cli.mjs`       | ESM CLI bundle (use via `typeorm-extension-esm`) | Rollup (swc)         |

The CLI bundle rewrites cross-domain imports back to `typeorm-extension` (see `rollup.config.mjs`) so consumers pay for the library once, not twice.

## Release Process

[`release-please`](https://github.com/googleapis/release-please) runs in `.github/workflows/release.yml`. It opens / updates a release PR on `master` based on Conventional Commit history. Merging the release PR bumps the version, updates `CHANGELOG.md`, tags, and publishes to npm.

Settings (`release-please-config.json`):

- `release-type: node`
- `prerelease: true`, `prerelease-type: alpha` — pre-1.0 / pre-release semantics apply.
- `bump-minor-pre-major: true`, `bump-patch-for-minor-pre-major: true` — `feat:` ⇒ minor, `fix:` ⇒ patch (no major bumps without explicit `BREAKING CHANGE`).

The manifest at `.release-please-manifest.json` tracks the current version.

## CI/CD

- `main.yml` runs on push to `master` and on PRs: `install → build → (lint || tests)` on Node 22.
- `release.yml` runs the release-please action and (on merge of a release PR) publishes to npm.
- Codecov receives coverage uploads via `codecov/codecov-action` (the badge in `README.MD` points to the report).

## Documentation Site

VitePress sources under `docs/`. The site is published to <https://typeorm-extension.tada5hi.net> (CNAME in repo root). Update `docs/guide/<topic>.md` whenever a change affects:

| Change                                | Docs to update                              |
|---------------------------------------|---------------------------------------------|
| New CLI option / command              | `docs/guide/cli.md`                         |
| New database driver                   | `docs/guide/database.md`                    |
| Seeder/factory contract change        | `docs/guide/seeding.md`                     |
| `applyQuery` options / parameter shape| `docs/guide/query.md`                       |
| Env var rename or addition            | Update both `docs/guide/` page and `README.MD` |

## Best Practices

- Use **ESM** and modern TypeScript. CJS support is a build output, not a code-style choice.
- Before adding new code, study surrounding patterns — especially the context-builder pattern in `src/database/methods/*` and the singleton-registry pattern in `src/data-source/singleton.ts`.
- Don't introduce new singletons unless the state is genuinely process-global (DataSource registry, factory manager, env cache are the existing ones — that should be roughly the full set).
- When extending the JSON:API query layer, check `rapiq` first — most parsing behavior lives there, and the local `applyQuery*` functions should stay focused on TypeORM translation.
- Keep driver files self-contained: connect with the native client, run SQL, close. Don't import from sibling driver files.
- Prefer typed errors from `src/errors/` over `throw new Error(...)` when a consumer might catch the error.
