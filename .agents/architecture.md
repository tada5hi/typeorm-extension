# Architecture

`typeorm-extension` is a library, not a service. There are four loosely-coupled feature domains, all built on top of TypeORM, and all reachable either through the public API (`src/index.ts`) or the CLI (`src/cli/index.ts`).

## Overview

```
                                ┌─────────────────────────────┐
                                │  CLI  (bin/cli.mjs)         │
                                │  citty commands             │
                                └──────────────┬──────────────┘
                                               │ delegates to
              ┌─────────────────┬──────────────┴──────────────┬─────────────────┐
              ▼                 ▼                              ▼                 ▼
       ┌────────────┐   ┌──────────────┐              ┌──────────────┐   ┌──────────────┐
       │  database  │   │   seeder     │              │ data-source  │   │    query     │
       │ create/drop│   │  run/track   │              │  registry    │   │  applyQuery  │
       │   /check   │   │              │              │  +discovery  │   │              │
       └─────┬──────┘   └──────┬───────┘              └──────┬───────┘   └──────┬───────┘
             │                 │                             │                  │
             ▼                 ▼                             ▼                  ▼
       ┌────────────┐   ┌──────────────┐              ┌──────────────┐   ┌──────────────┐
       │core/ +     │   │  factory/    │              │  options/    │   │ parameter/   │
       │adapters/   │   │  (faker)     │              │  env merge   │   │  rapiq parse │
       │schema/     │   │              │              │              │   │              │
       └────────────┘   └──────────────┘              └──────────────┘   └──────────────┘

  Shared infra: src/runtime (state registry), src/env (envix), src/errors, src/utils (path-resolver/file-path/tsconfig/object), src/helpers
```

The CLI is a *thin* layer — every command just calls a function from the public API.

## Core Design Decisions

### 1. Database dialects behind connection factories (core + adapters)

The `database` domain is split hexagonally ([RFC #1400](https://github.com/tada5hi/typeorm-extension/issues/1400)):

- **`src/database/core/`** — the pure side. One folder per dialect (`postgres/`, `mysql/`, `mssql/`, `oracle/`, `mongodb/`, `cockroachdb/`, `sqlite/`), each with `statements.ts` (pure SQL string builders) and `module.ts` (a `class <X>Dialect implements IDatabaseDialect` with its connection factory injected via the constructor, orchestrating create/drop with `try/finally` lifecycle). Also owns the connection interfaces (`IDatabaseConnection`, `IDatabaseConnectionFactory`, `IFileSystem`) and `buildConnectionParams()` (DataSourceOptions → dialect-neutral `ConnectionParams`, derived once per operation). Statements are strings in the server's native language — SQL text, or for mongodb a JSON encoded command document executed via `db.command()`. **Dialects must stay pure**: types, typed errors and pure helpers only — no native clients, no I/O, no env state.
- **`src/database/adapters/`** — the impure side, and the only files touching native clients or `node:fs`. Each adapter (`PostgresConnectionFactory`, `MySQLConnectionFactory`, `MsSQLConnectionFactory`, `OracleConnectionFactory`, `MongoDBConnectionFactory`, `NodeFileSystem`) acquires its native client lazily in `open()` via TypeORM's `DriverFactory` (`useNativeDriver()` — typeorm stays the single source of client libraries). Adapters are internal — not re-exported from the public barrel.
- **`src/database/registry.ts`** — the single dispatch site: a closed `Record<DatabaseDialectName, entry>` wiring each dialect to its adapter (`mariadb` resolves to `mysql`; cockroachdb reuses the postgres adapter). No plugin system — driver support is a closed set known at build time. Adding a driver = one dialect folder in `core/`, one adapter, one registry row.
- **`src/database/methods/execute.ts`** — the composition root (`executeDatabaseCreate` / `executeDatabaseDrop`): resolves the registry entry, derives params once, builds the dialect with its connection factory (honouring `DatabaseDialectOverrides` for tests and the caller-supplied `connection` on the context), and runs `synchronizeDatabaseSchema` exactly once after create.

Tests inject an in-memory recording server (`test/data/database/`) through the composition root — no live database needed to assert generated SQL, connection targeting and close ordering. The per-driver functions (`createPostgresDatabase`, …, in `src/database/driver/`) are deprecated delegates through the same composition root; remove them in the next major.

The peer-dep range is `typeorm ^1.0.0`. TypeORM 0.3 is **not** supported on `typeorm-extension` v4+ — stay on `typeorm-extension` v3 if you need it. TypeORM 1.0 also removed the legacy `sqlite` driver (only `better-sqlite3` remains) and renamed deep types like `PostgresConnectionOptions` → `PostgresDataSourceOptions`; the code is already migrated.

### 2. Operations bypass `DataSource.initialize()`

`createDatabase` / `dropDatabase` cannot use a TypeORM `DataSource`, because the database might not exist yet. Each adapter in `src/database/adapters/` opens a *raw* native client (e.g. `pg.Client`, `mysql2.createConnection`) using the derived `ConnectionParams`, exposes it through the `IDatabaseConnection` interface, and the dialect closes the connection in a `finally` block. The TypeORM `Driver` object is used only for its native client reference (`driver.postgres`, `driver.mysql`) — never `.connect()`d. Callers may alternatively supply their own server-level connection via the context's `connection` field; the library never closes a caller-owned connection.

### 3. DataSource registry with alias-keyed lazy init

`src/data-source/singleton.ts` stores data sources in the runtime registry's alias-keyed `AsyncKeyedCache`, so `useDataSource(alias)` is idempotent and concurrent-safe (concurrent calls share one build; a failed build is evicted for retry). The default alias is `'default'`. `setDataSource()` registers a pre-built instance; `useDataSource()` builds + initializes one from discovered options if none is registered. This is why the library can be used in apps that never call `findDataSource` themselves.

### 4. Query application delegates parsing to `rapiq`

`query/module.ts` does not parse query strings itself — it calls `parseQuery(input, options)` from `rapiq`, then walks the resulting `ParseOutput` and applies each branch to the `SelectQueryBuilder`. The five `applyQuery<X>ParseOutput` functions in `query/parameter/<x>/` are pure TypeORM-side adapters. **When fixing a query bug, first check whether the bug is in `rapiq` (parsing) or in the apply step (TypeORM translation).**

### 5. Seeder tracking mirrors TypeORM's migration tracking

`SeederExecutor` (`src/seeder/executor.ts`) follows the same shape as TypeORM's `MigrationExecutor`: a `seeds` table with `id`, `timestamp`, `name`, populated only when tracking is enabled (per-seed `track = true` or executor-level `seedTracking`, resolved from input ← data-source options). MongoDB uses a collection instead. Untracked seeds re-run on every invocation. The per-seed decision lives in `SeederEntity.effectiveTracking(fallback)`; execution order in the static `SeederEntity.compare` comparator. The table name comes from `seedTableName` (input ← data-source options ← `'seeds'`).

### 6. Schema operations are a separate domain from create/drop

`src/database/` splits along the "is there a schema to talk to?" line:

- `methods/` + `core/` + `adapters/` — everything which must work **before** the database exists, over a raw native client.
- `schema/` — everything which needs an **initialized** `DataSource` / `QueryRunner`: `synchronizeDatabaseSchema`, the drift assertion and the guarded alter helpers.

`getSchemaDrift` wraps `dataSource.driver.createSchemaBuilder().log()` — the same call `migration:generate` makes — and reports the statements which would reconcile the database schema with the entity metadata. A project which builds its schema with migrations in production but with `synchronize()` in tests has no guard against the two descriptions drifting apart; the intended use is a CI gate right after `migration run` (`migration run → revert × N → run → assert zero drift`). `skipWithoutMigrations` short-circuits for a data source wired with `migrations: []` (e.g. sqlite in tests).

The alter helpers (`renameIndex`, `renameForeignKey`, `changeColumnType`) exist because repairing that drift means renaming constraints, which is dialect-asymmetric:

- postgres: `ALTER INDEX … RENAME TO`, `ALTER TABLE … RENAME CONSTRAINT`.
- mysql: `ALTER TABLE … RENAME INDEX` exists, but there is no `RENAME CONSTRAINT` — the foreign key has to be dropped and re-added, and the backing index mysql created **under the constraint name** survives the drop and has to be renamed (or dropped) first, or the table ends up with a duplicate.

Two invariants shape the implementation:

1. **Every helper is a guarded no-op when it does not apply** (returns `false`). mysql commits DDL regardless of the surrounding transaction, so a repair migration must be resumable after a partial failure and safe to run against a database which never had the drift.
2. **Current state comes from `queryRunner.getTable()`**, never from caller-supplied metadata — `renameForeignKey` re-adds the constraint with the columns/referenced table/referential actions it read back, so the rename cannot silently change the constraint. Note that mysql's driver hides an index whose name matches a referential constraint, which is exactly why the backing index only becomes visible after the constraint is dropped.

The dialect statements themselves live in `src/database/schema/statements.ts` as pure builders (`resolveSchemaDialect` maps `cockroachdb → postgres`, `mariadb → mysql`, and raises `DriverError.schemaAlterationNotSupported` for the rest). `changeColumnType` is the exception: it delegates to `queryRunner.changeColumn()` and therefore works on every driver. `withForeignKeyChecksDisabled` reads `@@SESSION.foreign_key_checks` first and only restores it if it was on (nesting safe); on a non-mysql driver it just runs the callback so a migration stays portable.

## Design Patterns

### Context-builder pattern (database methods)

Each public method (`createDatabase`, `dropDatabase`, `checkDatabase`) takes a loose `ContextInput` object and runs it through a `buildXContext()` function in `src/database/utils/context.ts` that:

1. Resolves the `DataSourceOptions` (passed in, or discovered via `findDataSource`).
2. Layers env-var defaults from `useEnv()` over them.
3. Returns a fully-resolved `Context` (options + flags like `ifNotExist`, `synchronize`, `initialDatabase`).

The composition root then receives the resolved context and trusts every field — the context is built exactly once per operation. **Never reach for `useEnv()` or `findDataSource()` from a dialect or adapter — that work belongs in the context builder.**

```ts
// src/database/methods/create/module.ts
export async function createDatabase(input: DatabaseCreateContextInput = {}) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate(resolveDatabaseDialectName(context.options.type), context);
}
```

### Runtime registry pattern (data sources, options, env, factories)

All state that must survive across calls in the same process lives in one place: the `RuntimeRegistry` (`src/runtime/module.ts`, reachable via `useRuntimeRegistry()`). It owns four slots:

- `dataSources` / `dataSourceOptions` — two alias-keyed `AsyncKeyedCache` instances (`src/runtime/cache.ts`): get-or-build with concurrent-call dedupe and failed-build eviction.
- `env` — the memoized `Environment` read by `useEnv()`.
- `factories` — the `SeederFactoryManager` instance (`items` keyed by entity name).

The registry is **internal** (not in the public barrel). Consumers interact through the per-domain accessors, which are thin delegates: `setDataSource` / `hasDataSource` / `useDataSource` / `unsetDataSource`, `setDataSourceOptions` / `hasDataSourceOptions` / `useDataSourceOptions`, `useEnv` / `resetEnv`, `useSeederFactoryManager` / `setSeederFactory` / `resetSeederFactoryManager`. `RuntimeRegistry.reset()` restores a pristine process state (used by tests).

`useEnv()` is cached on first read; tests that mutate `process.env` must call `resetEnv()` between cases. Don't add new process-global state outside the registry.

Note: `SeederExecutor` does **not** register its data source globally (a v3 side effect removed in v4). Each run gets a `SeederFactoryManager` bound to the executor's data source (sharing the globally registered factory items), so factory `save()` persists into the executor's database; unbound factories fall back to `useDataSource()`.

### defineCommand pattern (CLI)

Each command is a `defineCommand` factory from [`citty`](https://github.com/unjs/citty) (see `src/cli/commands/database/create.ts`). These factories are **internal** to the CLI bundle and are not re-exported from `src/index.ts` — the public API surface for the library deliberately stops at the runtime helpers (`createDatabase`, `runSeeder`, etc.). The CLI entry composes the command tree in `src/cli/module.ts` and hands it to citty's `runMain`:

```ts
// src/cli/module.ts (shape)
export function createCLIEntryPointCommand() {
    return defineCommand({
        meta: { name: 'typeorm-extension', description: '...' },
        subCommands: {
            db: defineCLIDatabaseCommand(),       // → db create / db drift / db drop
            seed: defineCLISeedCommand(),         // → seed create / seed run
            // Legacy colon-form aliases (kept for v3 backwards compatibility).
            'db:create': defineCLIDatabaseCreateCommand(),
            'db:drop': defineCLIDatabaseDropCommand(),
            'seed:create': defineCLISeedCreateCommand(),
            'seed:run': defineCLISeedRunCommand(),
        },
    });
}

// src/cli/index.ts
runMain(createCLIEntryPointCommand());
```

Why both forms: nested subcommands (`db create`) are the canonical citty idiom and match the way the user docs are now written. The colon-form keys are registered as separate `subCommands` entries pointing at the same `defineCommand` instances, so `typeorm-extension db:create` keeps working for npm-script consumers upgrading from v3. When deprecating, remove the colon-form keys from `createCLIEntryPointCommand`.

### CLI logger + exit handling

CLI output goes through a small TTY-aware logger in `src/cli/logger.ts` (`info` / `success` / `warn` / `error` / `debug` + a `section(title)` header and `kv(key, value, padTo)` aligned key-value renderer; ANSI colour codes are stripped when stderr is not a TTY). Every command exposes a `--log-level silent|info|debug` arg. `consola` is intentionally **not** used — keeping the logger in-tree avoids pulling a runtime dep into the CLI bundle just for output formatting.

Each command body runs inside `runWithExitCode(logger, async () => { … })` (`src/cli/exit.ts`). The wrapper turns thrown errors into deterministic exit codes:

| Thrown                | Logger call             | Exit code |
|-----------------------|-------------------------|-----------|
| Resolves              | —                       | `0`       |
| `CLIUserError`        | `logger.error(message)` | `1`       |
| Other `Error`         | `logger.error(stack)`   | `2`       |
| Non-`Error` value     | `logger.error(String)`  | `2`       |

`CLIUserError` is the typed sentinel for "the user did something wrong" (missing directory, invalid argument value). Throw it instead of calling `process.exit(1)` inline — keeps each command's success path linear.

### Factory pattern (seeder/factory)

`setSeederFactory(Entity, callback)` registers a faker-driven generator with the global `SeederFactoryManager`. A `Seeder.run(dataSource, factoryManager)` impl calls `factoryManager.get(Entity).createMany(n)`. The factory `callback` receives a `Faker` instance from `@faker-js/faker` (peer dep — only loaded when factories are actually used). The manager handed to `run()` is bound to the executor's data source (sharing the global `items`), so `save()` / `saveMany()` persist there; factories resolved outside a run fall back to `useDataSource()`.

## Data Flow

### Create / Drop database

```
Input:
  └── DataSourceOptions (passed in) or env vars / discovered data-source file

Processing:
  1. buildDatabaseXContext() resolves options + flags (context built exactly once)
  2. resolveDatabaseDialectName() → registry entry (dialect + adapter wiring)
  3. buildConnectionParams() derives dialect-neutral connection facts once
  4. dialect orchestrates over the connection factory: adapter connects a raw native client
     (bypassing TypeORM init), SQL from statements.ts runs, connection closes in finally
  5. (create only) the composition root optionally synchronizes the schema once

Output:
  └── driver-native result (Promise<unknown>) — caller usually ignores it
```

### Seeder execution

```
Input:
  └── DataSource + SeederOptions { seeds, factories, seedName?, seedTableName?, seedTracking? }

Processing (SeederExecutor.execute — one named stage per step):
  1. resolveConfig(): pure resolveSeederConfig(input, dataSource.options, env) — precedence
     input ← dataSource.options ← env ← defaults (src/seeder/config.ts) — then path transformation
     via the executor's PathResolver (preserveFilePaths ⇒ mode 'preserve', else 'auto' with JIT probe)
  2. prepareSeederFactories() loads factory files via glob → registers in the global manager
  3. loadEntities(): prepareSeederSeeds() loads seed files via glob → SeederEntity list,
     ordered by SeederEntity.compare (fileName, then timestamp)
  4. If tracking: create the seedTableName table if missing, load already-executed names
  5. filterPending(): (matches seedName?) AND (not already tracked OR not
     SeederEntity.effectiveTracking(seedTracking))
  6. runPending(): instantiate, call .run(dataSource, factoryManager) with a manager bound to
     the executor's data source, optionally insert tracking row

Output:
  └── SeederEntity[] of seeds actually executed
```

### Query application

```
Input:
  └── SelectQueryBuilder<T> + raw query input (req.query shape) + QueryApplyOptions<T>

Processing:
  1. applyQuery normalizes options (defaults each parameter to `false` if not allow-listed)
  2. parseQuery(input, options) from rapiq → ParseOutput { fields, filters, pagination, relations, sort }
  3. For each present branch, call applyQuery<X>ParseOutput(qb, parsed, opts)
  4. Each apply function mutates the QueryBuilder in place (.select / .where / .leftJoin / .orderBy / .skip+.take)

Output:
  └── QueryApplyOutput (ParseOutput + defaultAlias) — caller still owns the qb
```

## Error Handling

- `TypeormExtensionError` (`src/errors/base.ts`) is the root. It extends `Error` and adds nothing on its own — subclasses give semantic meaning.
- `DriverError` (e.g. `DriverError.notSupported(type)`) is thrown by `resolveDatabaseDialectName()` on a registry miss, and `DriverError.connectionClosed()` when a closed connection is reused.
- `OptionsError` is thrown when the context builder cannot resolve a DataSource / options.
- `SchemaDriftError` is thrown by `assertSchemaMatchesMetadata()` and carries the reconciling `statements` (its message lists them, so an unhandled throw in CI is already the report).
- Anywhere else, library code lets the underlying error (TypeORM, the native driver, faker, file-system) propagate. **Do not wrap errors just to add a message** — wrap only when you need a typed error the caller can catch.

## File Structure (architecture → paths)

```text
Public entry             → src/index.ts
CLI entry                → src/cli/index.ts          (bundled to bin/cli.mjs)
CLI command tree          → src/cli/module.ts          (createCLIEntryPointCommand)
Database create/drop     → src/database/methods/{create,drop,check}/module.ts
Composition root         → src/database/methods/execute.ts
Dialect registry         → src/database/registry.ts
Per-dialect SQL          → src/database/core/<dialect>/statements.ts
Dialect orchestration    → src/database/core/<dialect>/module.ts
Connector interfaces (types) → src/database/core/type.ts
Native client adapters   → src/database/adapters/<driver>.ts
Deprecated delegates     → src/database/driver/<driver>.ts (removed next major)
Context builders         → src/database/utils/context.ts
Schema sync after create → src/database/schema/synchronize.ts
Schema drift assertion   → src/database/schema/drift.ts
Guarded schema alters    → src/database/schema/alter.ts (+ statements.ts — pure DDL builders)
Runtime state registry   → src/runtime/module.ts (+ cache.ts — AsyncKeyedCache)
DataSource registry      → src/data-source/singleton.ts (delegates to src/runtime)
DataSource discovery     → src/data-source/find/module.ts
DataSource options merge → src/data-source/options/module.ts + utils/{env,merge}.ts
Seeder runtime           → src/seeder/executor.ts, src/seeder/module.ts
Seeder config resolver   → src/seeder/config.ts (resolveSeederConfig)
Factory registry         → src/seeder/factory/manager.ts
Query applier            → src/query/module.ts
Per-parameter appliers   → src/query/parameter/<concern>/module.ts
Path resolver            → src/utils/path-resolver/module.ts (createPathResolver; adjustFilePath(s) delegate to it)
Env reader               → src/env/module.ts (+ constants.ts for var names)
```

## Configuration

`useEnv()` reads from a primary and an `_ALT` variant for every key (see `src/env/constants.ts` — the `_ALT` group is the `DB_*` aliases for the canonical `TYPEORM_*` names). All values are lazily cached on first call; call `resetEnv()` in tests after mutating `process.env`.

Selected variables (full list in `src/env/constants.ts`):

| Variable                            | Purpose                                              |
|-------------------------------------|------------------------------------------------------|
| `TYPEORM_CONNECTION` / `DB_TYPE`    | Driver type (`postgres`, `mysql`, …)                 |
| `TYPEORM_URL` / `DB_URL`            | Connection URL (driver inferred from scheme)         |
| `TYPEORM_HOST` / `DB_HOST`          | Host                                                 |
| `TYPEORM_PORT` / `DB_PORT`          | Port (int)                                           |
| `TYPEORM_USERNAME` / `DB_USER`      | Username                                             |
| `TYPEORM_PASSWORD` / `DB_PASS`      | Password                                             |
| `TYPEORM_DATABASE` / `DB_NAME`      | Database name                                        |
| `TYPEORM_SCHEMA` / `DB_SCHEMA`      | Schema (postgres / mssql)                            |
| `TYPEORM_SEEDS` / `DB_SEEDS`        | Glob(s) for seeder files                             |
| `TYPEORM_FACTORIES` / `DB_FACTORIES`| Glob(s) for factory files                            |
| `TYPEORM_SYNCHRONIZE`               | Auto-sync schema after `db:create`                   |
| `TYPEORM_MIGRATIONS_RUN`            | Run migrations on initialize                         |
