# Project Structure

Single-package TypeScript library. Source lives in `src/`, tests in `test/`, docs in `docs/`. Build artefacts go to `dist/` (library bundles) and `bin/` (CLI bundles).

## Directory Layout

```
typeorm-extension/
├── src/
│   ├── index.ts                # Public barrel — re-exports every public module
│   ├── cli/                    # citty-based CLI (bundled separately into bin/)
│   │   ├── index.ts            # CLI entry: calls runMain(createCLIEntryPointCommand())
│   │   ├── module.ts           # createCLIEntryPointCommand — wires subCommands (db, seed) + legacy colon aliases
│   │   ├── logger.ts           # TTY-aware logger (info/success/warn/error/debug + section/kv/blank) + CLIUserError
│   │   ├── exit.ts             # runWithExitCode wrapper + ExitCode enum
│   │   └── commands/
│   │       ├── database/       # `db` parent + `create`/`drift`/`drop` subcommands (citty defineCommand)
│   │       └── seed/           # `seed` parent + `create`/`run` subcommands
│   ├── data-source/            # DataSource discovery, options, and singleton registry
│   │   ├── find/               # findDataSource() — locate data-source file on disk
│   │   ├── options/            # buildDataSourceOptions, env-merge, file load
│   │   ├── singleton.ts        # set/has/use/unsetDataSource(alias)
│   │   └── type.ts
│   ├── database/               # Database create/drop/check, per-dialect
│   │   ├── methods/            # createDatabase / dropDatabase / checkDatabase + execute.ts (composition root)
│   │   ├── core/               # PURE: dialect per driver (statements.ts + module.ts), connection interfaces (I-prefixed), params
│   │   ├── adapters/           # native client glue behind the connection interfaces (only files touching pg/mysql2/mssql/... or node:fs)
│   │   ├── registry.ts         # the single dialect dispatch table (closed set)
│   │   ├── driver/             # deprecated per-driver delegates (removed next major)
│   │   ├── schema/             # schema level ops against an initialized DataSource / QueryRunner
│   │   │   ├── synchronize.ts  # synchronizeDatabaseSchema — run migrations or synchronize()
│   │   │   ├── drift.ts        # getSchemaDrift / assertSchemaMatchesMetadata
│   │   │   ├── alter/          # guarded renameIndex / renameForeignKey / changeColumnType / withForeignKeyChecksDisabled
│   │   │   └── alter/statements.ts # PURE per-dialect DDL builders (+ dialect.ts — find/resolveSchemaDialect)
│   │   └── utils/              # context builders, migration helpers
│   ├── env/                    # `useEnv()` — read TYPEORM_* / DB_* env vars (via envix)
│   ├── errors/                 # TypeormExtensionError + DriverError + OptionsError + SchemaDriftError + SchemaAlterationError + EntityMetadataError + EntityRelationLookupError (one class per file)
│   ├── helpers/                # Entity runtime helpers
│   │   └── entity/             # name, metadata, property-names, join-column validation, uniqueness
│   ├── runtime/                # Process-global state registry (internal, not in the public barrel)
│   │   ├── cache.ts            # AsyncKeyedCache — keyed get-or-build with concurrent dedupe
│   │   └── module.ts           # RuntimeRegistry + useRuntimeRegistry() — owns data sources, options, env, factories
│   ├── seeder/                 # Seeder + factory runtime
│   │   ├── config.ts           # resolveSeederConfig — pure precedence resolver (input ← ds options ← env ← defaults)
│   │   ├── executor.ts         # SeederExecutor — named pipeline stages + tracking table
│   │   ├── module.ts           # runSeeder / runSeeders
│   │   ├── factory/            # SeederFactory + SeederFactoryManager (faker bridge)
│   │   └── utils/              # template, seeder file-name derivation, glob prep
│   └── utils/                  # Pure helpers: object/promise/file-path/tsconfig
│       └── path-resolver/      # createPathResolver — owns the JIT-vs-compiled path rewrite decision
├── test/
│   ├── vitest.config.ts        # root is repo root; suites under test/unit/
│   ├── vitest.setup.ts         # locter setModuleLoader bridge into vitest's module graph
│   ├── data/                   # Shared fixtures
│   │   ├── entity/             # User, Role TypeORM entities
│   │   ├── factory/            # Faker factories for the fixtures
│   │   ├── seed/               # Seeders that use the factories
│   │   ├── typeorm/            # DataSource fixtures (sync, async, default) + FakeQueryRunner
│   │   └── tsconfig.json
│   └── unit/                   # Test suites mirroring src/ folder names
├── docs/                       # VitePress site (guide/, index.md)
├── bin/                        # tsdown output: cli.mjs (gitignored, built)
├── dist/                       # tsdown output: index.mjs + index.d.mts
├── tsdown.config.ts            # Two entries: src/cli/index.ts → bin/, src/index.ts → dist/
├── eslint.config.mjs           # ESLint v10 flat config (extends @tada5hi/eslint-config v2)
├── tsconfig.json               # extends @tada5hi/tsconfig; emit decorators + metadata
├── package.json                # "type": "module" — ESM-only
└── release-please-config.json  # release-please manifest-driven releases
```

## Module Responsibilities

| Module           | Purpose                                                                                                |
|------------------|--------------------------------------------------------------------------------------------------------|
| `cli/`           | Process entry for the `typeorm-extension` binary. Thin wrapper over the public API.                   |
| `data-source/`   | Locate, build, and cache `DataSource` instances by alias. Backbone for every other feature.            |
| `database/`      | Driver-specific `create` / `drop` / `check` operations that do not require an initialized DataSource.  |
| `database/schema/` | Schema-level operations which *do* need an initialized DataSource / QueryRunner: synchronize, drift detection, guarded rename/alter helpers for repair migrations. |
| `env/`           | Read `TYPEORM_*` and `DB_*` environment variables into a strongly-typed `Environment` record.          |
| `errors/`        | Error class hierarchy (`TypeormExtensionError` → `DriverError` / `OptionsError` / `SchemaDriftError` / `SchemaAlterationError` / `EntityMetadataError` / `EntityRelationLookupError`). One class per file; every error a consumer may catch lives here, not next to its thrower. |
| `helpers/`       | Entity runtime helpers (`getEntityName`, `getEntityMetadata`, `getEntityPropertyNames`, `validateEntityJoinColumns`, `isEntityUnique`). Only `getEntityName` is used internally (seeder factory manager) and is the only stable one; the rest stay `@experimental` public API for downstream CRUD layers (authup, PrivateAIM hub). Documented in `docs/guide/entity-api-reference.md`. |
| `runtime/`       | Internal registry for process-global state (data sources, options, env, factory manager) with a uniform `reset()`. |
| `seeder/`        | Discover and execute seeders, manage factories, track executed seeds in a `seeds` table.               |
| `utils/`         | Generic, framework-free helpers (tsconfig reading, object/promise/slash utils) + `createPathResolver`, the single owner of path absolutization and the JIT-vs-compiled rewrite (`mode: auto \| preserve \| transform`; `preserveFilePaths` maps to `preserve`). |

## Key Dependencies

| Dependency           | Role                                                                                          |
|----------------------|-----------------------------------------------------------------------------------------------|
| `typeorm` (peer)     | The ORM being extended. Requires `^1.1.0` (TypeORM 0.3 is no longer supported).                |
| `@faker-js/faker`    | Optional peer — only required when using `SeederFactory`.                                     |
| `locter`             | Glob + file loading (used to discover data-source / seed / factory files).                    |
| `envix`              | Typed env var reader (`read`, `readArray`, `readBool`, `readInt`, `oneOf`).                   |
| `citty`              | CLI argument parser. Each command is a `defineCommand` factory; subcommands compose via `subCommands`. |
| `smob`               | Object merge utility (deep merge of data-source options).                                     |
| `reflect-metadata`   | Imported at the top of `src/cli/index.ts` so TypeORM decorators work in CLI-loaded files.     |
| `pascal-case`        | Used in seed/factory file generation (template stamps `PascalCaseName`).                      |

## Package Exports

```json
{
    "./package.json": "./package.json",
    ".": {
        "types": "./dist/index.d.mts",
        "import": "./dist/index.mjs"
    },
    "./bin/*": "./bin/*"
}
```

ESM-only. CJS consumers on Node 22+ can still `require('typeorm-extension')` thanks to Node's `require(esm)` support.

`src/index.ts` is the public barrel; anything re-exported there is public API:

```ts
export * from './errors';
export * from './database';
export * from './data-source';
export * from './env';
export * from './helpers';
export * from './seeder';
export * from './utils';
```

CLI command factories are **not** part of the public barrel — they are internal to the CLI bundle. Consumers who want to embed a command into their own citty pipeline should fork or copy it; that surface is no longer a public API contract.

`src/cli/index.ts` is **not** in the public barrel — it is the executable entry, bundled separately into `bin/cli.mjs` by tsdown. A tsdown plugin (`cliRewriteExternal` in `tsdown.config.ts`) rewrites cross-domain imports inside `src/cli/` to import from `typeorm-extension` itself, so the CLI bundle stays small AND shares singleton state (data-source registry, env cache, factory manager) with the library that consumers import directly.

## Separation of Concerns

- **CLI parsing** → `src/cli/` (citty only).
- **Public, programmatic API** → everything else under `src/`, re-exported from `src/index.ts`.
- **Driver-specific SQL** → `src/database/core/<dialect>/statements.ts` (pure builders), orchestrated by `src/database/core/<dialect>/module.ts` over the connections; native clients live only in `src/database/adapters/`. Adding a new TypeORM driver means one dialect folder in `core/`, one adapter, and one row in `src/database/registry.ts`.
- **Schema-level DDL** → `src/database/schema/alter/statements.ts` (pure per-dialect builders, driven by `resolveSchemaDialect` in `alter/dialect.ts`), orchestrated over a typeorm `QueryRunner` by one file per concern (`alter/indices.ts`, `alter/foreign-keys.ts`, `alter/columns.ts`, `alter/checks.ts`). Only `postgres`/`cockroachdb` and `mysql`/`mariadb` are known to the dialect table: the renames raise `DriverError.schemaAlterationNotSupported` for every other driver, `changeColumnType` falls back to `queryRunner.changeColumn()` instead (`findSchemaDialect` vs. `resolveSchemaDialect`). `alter/index.ts` deliberately re-exports **only** the four helpers and their input types — the statement builders, the escapers and `resolveSchemaDialect` stay internal, and their specs import them by path. Don't widen that barrel to `export *`: every symbol in it is a compatibility promise.
- **Side-effectful state** (DataSource registry, options cache, env cache, factory manager) → one `RuntimeRegistry` in `src/runtime/module.ts`; the public accessors (`setDataSource`/`useDataSource`, `useEnv`/`resetEnv`, `useSeederFactoryManager`/`resetSeederFactoryManager`, …) are thin delegates in their own domains.
