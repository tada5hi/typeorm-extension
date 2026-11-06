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

`setSeederFactory(Entity, callback)` registers a generator callback with the global `SeederFactoryManager`. A `Seeder.run(dataSource, factoryManager)` impl calls `factoryManager.get(Entity).saveMany(n)`. The library is **generator-agnostic**: `FactoryCallback` is `(meta: Meta | undefined) => O | Promise<O>` and its only argument is the payload from `SeederFactory.setMeta()`. The `| undefined` is deliberate: the payload is unset until `setMeta()` runs, so a consumer has to declare the parameter optional, and it is what makes a v3 callback annotated `(faker: Faker)` a compile error instead of a runtime one. Data generation belongs to the consumer, who imports faker (or anything else) in the factory file. Before v4 a `Faker` instance was injected and `@faker-js/faker` was a peer dependency; that coupled the package to faker's export shape (`new fakerExports.Faker({ locale })` built by reflection), forced the dependency on every consumer and made `faker.seed()` unreachable. `setLocale()` went with it: locale selection is now `import { fakerDE as faker }`. Keep it that way, no generator import belongs in `src/`. The manager handed to `run()` is bound to the executor's data source (sharing the global `items`), so `save()` / `saveMany()` persist there; factories resolved outside a run fall back to `useDataSource()`.

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

## Error Handling

- `TypeormExtensionError` (`src/errors/base.ts`) is the root. It extends `Error` and adds nothing on its own — subclasses give semantic meaning.
- `DriverError` (e.g. `DriverError.notSupported(type)`) is thrown by `resolveDatabaseDialectName()` on a registry miss, and `DriverError.connectionClosed()` when a closed connection is reused.
- `OptionsError` is thrown when the context builder cannot resolve a DataSource / options.
- `SchemaDriftError` is thrown by `assertSchemaMatchesMetadata()` and carries the reconciling `statements` (its message lists them, so an unhandled throw in CI is already the report).
- `SchemaAlterationError` is thrown by the guarded alter helpers when the database is in neither the expected nor the desired state and `strict` is on (the default).
- `DatabaseLockError` is thrown by `withDatabaseLock()` when the lock can not be acquired within `timeout` (`timeout`), the query runner already has an open transaction (`transactionActive`) or `fn` left one open (`transactionLeftOpen`); `DriverError.lockNotSupported()` on a driver without a real advisory lock (or, for `withLockedEntity`, without a row lock), `DriverError.lockNowaitNotSupported()` for `onLocked` on mssql.
- Anywhere else, library code lets the underlying error (TypeORM, the native driver, a factory callback, file-system) propagate. **Do not wrap errors just to add a message** — wrap only when you need a typed error the caller can catch.

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
Schema drift assertion   → src/database/schema/drift/module.ts
Migration generation     → src/database/utils/migration.ts (reuses typeorm's MigrationGenerateCommand statics)
Guarded schema alters    → src/database/schema/alter/{indices,foreign-keys,columns,checks}.ts
Pure schema DDL builders → src/database/schema/alter/statements.ts (+ dialect.ts — find/resolveSchemaDialect)
Database lock            → src/database/lock/module.ts (withDatabaseLock)
Row lock                 → src/database/lock/entity.ts (withLockedEntity)
Driver error classifiers → src/database/error/module.ts
Runtime state registry   → src/runtime/module.ts (+ cache.ts — AsyncKeyedCache)
DataSource registry      → src/data-source/singleton.ts (delegates to src/runtime)
DataSource discovery     → src/data-source/find/module.ts
DataSource options merge → src/data-source/options/module.ts + utils/{env,merge}.ts
Seeder runtime           → src/seeder/executor.ts, src/seeder/module.ts
Seeder config resolver   → src/seeder/config.ts (resolveSeederConfig)
Factory registry         → src/seeder/factory/manager.ts
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
