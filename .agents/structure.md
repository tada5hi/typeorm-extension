# Project Structure

Single-package TypeScript library. Source lives in `src/`, tests in `test/`, docs in `docs/`. Build artefacts go to `dist/` (library bundles) and `bin/` (CLI bundles).

## Directory Layout

```
typeorm-extension/
├── src/
│   ├── index.ts                # Public barrel — re-exports every public module
│   ├── cli/                    # yargs-based CLI (bundled separately into bin/)
│   │   ├── index.ts            # CLI entry: registers commands, parses argv
│   │   └── commands/
│   │       ├── database/       # db:create, db:drop  (yargs CommandModule classes)
│   │       └── seed/           # seed:run, seed:create
│   ├── data-source/            # DataSource discovery, options, and singleton registry
│   │   ├── find/               # findDataSource() — locate data-source file on disk
│   │   ├── options/            # buildDataSourceOptions, env-merge, file load
│   │   ├── singleton.ts        # set/has/use/unsetDataSource(alias)
│   │   └── type.ts
│   ├── database/               # Database create/drop/check, per-driver
│   │   ├── methods/            # createDatabase / dropDatabase / checkDatabase
│   │   ├── driver/             # One file per TypeORM driver (postgres/mysql/...)
│   │   └── utils/              # context builders, schema sync, migration helpers
│   ├── env/                    # `useEnv()` — read TYPEORM_* / DB_* env vars (via envix)
│   ├── errors/                 # TypeormExtensionError + DriverError + OptionsError
│   ├── helpers/                # entity helpers (getEntityName, etc.)
│   ├── query/                  # JSON:API-style query parameter application (rapiq-backed)
│   │   ├── module.ts           # applyQuery() / applyQueryParseOutput() — public entry
│   │   ├── parameter/          # fields, filters, pagination, relations, sort
│   │   └── utils/              # alias/key/option helpers
│   ├── seeder/                 # Seeder + factory runtime
│   │   ├── executor.ts         # SeederExecutor — orchestrates run + tracking table
│   │   ├── module.ts           # runSeeder / runSeeders
│   │   ├── factory/            # SeederFactory + SeederFactoryManager (faker bridge)
│   │   └── utils/              # template, file path resolution, glob prep
│   └── utils/                  # Pure helpers: object/promise/file-path/tsconfig
├── test/
│   ├── jest.config.js          # rootDir is repo root; testRegex /unit/.*
│   ├── data/                   # Shared fixtures
│   │   ├── entity/             # User, Role TypeORM entities
│   │   ├── factory/            # Faker factories for the fixtures
│   │   ├── seed/               # Seeders that use the factories
│   │   ├── typeorm/            # DataSource fixtures (sync, async, default) + FakeSelectQueryBuilder
│   │   └── tsconfig.json
│   └── unit/                   # Test suites mirroring src/ folder names
├── docs/                       # VitePress site (guide/, index.md)
├── bin/                        # Rollup output: cli.cjs, cli.mjs (gitignored, built)
├── dist/                       # Rollup output: index.cjs/mjs + tsc-emitted index.d.ts
├── rollup.config.mjs           # Two bundles: src/cli/index.ts and src/index.ts
├── tsconfig.json               # extends @tada5hi/tsconfig; emit decorators + metadata
├── package.json
└── release-please-config.json  # release-please manifest-driven releases
```

## Module Responsibilities

| Module           | Purpose                                                                                                |
|------------------|--------------------------------------------------------------------------------------------------------|
| `cli/`           | Process entry for the `typeorm-extension(-esm)` binaries. Thin wrapper over the public API.            |
| `data-source/`   | Locate, build, and cache `DataSource` instances by alias. Backbone for every other feature.            |
| `database/`      | Driver-specific `create` / `drop` / `check` operations that do not require an initialized DataSource.  |
| `env/`           | Read `TYPEORM_*` and `DB_*` environment variables into a strongly-typed `Environment` record.          |
| `errors/`        | Error class hierarchy (`TypeormExtensionError` → `DriverError` / `OptionsError`).                      |
| `helpers/`       | Entity-shape helpers (`getEntityName`) — used across seeder and query modules.                         |
| `query/`         | Apply parsed JSON:API query input onto a `SelectQueryBuilder`. Delegates parsing to `rapiq`.           |
| `seeder/`        | Discover and execute seeders, manage factories, track executed seeds in a `seeds` table.               |
| `utils/`         | Generic, framework-free helpers (tsconfig reading, file-path adjustment, object/promise/slash utils).  |

## Key Dependencies

| Dependency           | Role                                                                                          |
|----------------------|-----------------------------------------------------------------------------------------------|
| `typeorm` (peer)     | The ORM being extended. Pinned to `~0.3.0`.                                                   |
| `@faker-js/faker`    | Optional peer — only required when using `SeederFactory`.                                     |
| `rapiq`              | JSON:API query parser. `query/module.ts` is a thin TypeORM-flavoured adapter on top of it.    |
| `locter`             | Glob + file loading (used to discover data-source / seed / factory files).                    |
| `envix`              | Typed env var reader (`read`, `readArray`, `readBool`, `readInt`, `oneOf`).                   |
| `consola`            | CLI logger (used inside `src/cli/commands/*`).                                                |
| `yargs`              | CLI argument parser. Each command is a class implementing `CommandModule`.                    |
| `smob`               | Object merge utility (deep merge of data-source options).                                     |
| `reflect-metadata`   | Imported at the top of `src/cli/index.ts` so TypeORM decorators work in CLI-loaded files.     |
| `pascal-case`        | Used in seed/factory file generation (template stamps `PascalCaseName`).                      |

## Package Exports

```json
{
    "./package.json": "./package.json",
    ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.mjs",
        "require": "./dist/index.cjs"
    },
    "./bin/*": "./bin/*"
}
```

`src/index.ts` is the public barrel; anything re-exported there is public API:

```ts
export * from './errors';
export * from './query';
export * from './cli/commands';   // command classes are public (consumers can register them in their own yargs)
export * from './database';
export * from './data-source';
export * from './env';
export * from './helpers';
export * from './seeder';
export * from './utils';
```

`src/cli/index.ts` is **not** in the public barrel — it is the executable entry, bundled separately into `bin/cli.{cjs,mjs}` by Rollup. The rollup config rewrites cross-domain imports inside `src/cli/` to import from `typeorm-extension` itself, so the CLI bundle stays small and reuses the library at runtime.

## Separation of Concerns

- **CLI parsing** → `src/cli/` (yargs only).
- **Public, programmatic API** → everything else under `src/`, re-exported from `src/index.ts`.
- **Driver-specific SQL** → `src/database/driver/<driver>.ts`. Adding a new TypeORM driver means adding a file here and a `case` in `src/database/methods/{create,drop,check}/module.ts`.
- **Query application** → `src/query/parameter/<concern>/` — one folder per JSON:API concern (`fields`, `filters`, `pagination`, `relations`, `sort`).
- **Side-effectful state** (DataSource registry, env cache, factory manager) → singletons in `src/data-source/singleton.ts`, `src/env/module.ts`, `src/seeder/factory/manager.ts`.
