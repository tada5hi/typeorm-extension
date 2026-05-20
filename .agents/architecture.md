# Architecture

`typeorm-extension` is a library, not a service. There are four loosely-coupled feature domains, all built on top of TypeORM, and all reachable either through the public API (`src/index.ts`) or the CLI (`src/cli/index.ts`).

## Overview

```
                                ┌─────────────────────────────┐
                                │  CLI  (bin/cli.{cjs,mjs})   │
                                │  yargs commands             │
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
       │  drivers/  │   │  factory/    │              │  options/    │   │ parameter/   │
       │  per-DB    │   │  (faker)     │              │  env merge   │   │  rapiq parse │
       └────────────┘   └──────────────┘              └──────────────┘   └──────────────┘

  Shared infra: src/env (envix), src/errors, src/utils (file-path/tsconfig/object), src/helpers
```

The CLI is a *thin* layer — every command just calls a function from the public API.

## Core Design Decisions

### 1. Driver dispatch via `switch`, not a registry

`src/database/methods/create/module.ts` (and its `drop` / `check` siblings) own a single `switch` over `context.options.type` that maps each TypeORM `DatabaseType` to a driver-specific function in `src/database/driver/<driver>.ts`. There is no plugin registry — driver support is a closed set known at build time. Adding a driver = adding a file in `database/driver/` + adding a `case`. Keep this pattern; do not introduce a registry abstraction.

### 2. Operations bypass `DataSource.initialize()`

`createDatabase` / `dropDatabase` cannot use a TypeORM `DataSource`, because the database might not exist yet. Each driver file opens a *raw* native client (e.g. `pg.Client`, `mysql2.createConnection`) using credentials extracted from the data-source options, runs the SQL, and closes the connection. The TypeORM `Driver` object is used only for its connector reference (`driver.postgres`, `driver.mysql`) — never `.connect()`d.

### 3. DataSource registry with alias-keyed lazy init

`src/data-source/singleton.ts` keeps a `Record<alias, DataSource>` plus parallel promise caches so `useDataSource(alias)` is idempotent and concurrent-safe. The default alias is `'default'`. `setDataSource()` registers a pre-built instance; `useDataSource()` builds + initializes one from discovered options if none is registered. This is why the library can be used in apps that never call `findDataSource` themselves.

### 4. Query application delegates parsing to `rapiq`

`query/module.ts` does not parse query strings itself — it calls `parseQuery(input, options)` from `rapiq`, then walks the resulting `ParseOutput` and applies each branch to the `SelectQueryBuilder`. The five `applyQuery<X>ParseOutput` functions in `query/parameter/<x>/` are pure TypeORM-side adapters. **When fixing a query bug, first check whether the bug is in `rapiq` (parsing) or in the apply step (TypeORM translation).**

### 5. Seeder tracking mirrors TypeORM's migration tracking

`SeederExecutor` (`src/seeder/executor.ts`) follows the same shape as TypeORM's `MigrationExecutor`: a `seeds` table with `id`, `timestamp`, `name`, populated only when tracking is enabled (per-seed `track = true` or executor-level `seedTracking: true`). MongoDB uses a collection instead. Untracked seeds re-run on every invocation.

## Design Patterns

### Context-builder pattern (database methods)

Each public method (`createDatabase`, `dropDatabase`, `checkDatabase`) takes a loose `ContextInput` object and runs it through a `buildXContext()` function in `src/database/utils/context.ts` that:

1. Resolves the `DataSourceOptions` (passed in, or discovered via `findDataSource`).
2. Layers env-var defaults from `useEnv()` over them.
3. Returns a fully-resolved `Context` (options + flags like `ifNotExist`, `synchronize`, `initialDatabase`).

Driver functions then receive the resolved context and trust every field. **Never reach for `useEnv()` or `findDataSource()` from a driver file — that work belongs in the context builder.**

```ts
// src/database/methods/create/module.ts
export async function createDatabase(input: DatabaseCreateContextInput = {}) {
    const context = await buildDatabaseCreateContext(input);

    switch (context.options.type) {
        case 'postgres':   return createPostgresDatabase(context);
        case 'mysql':
        case 'mariadb':    return createMySQLDatabase(context);
        // ...
        default:           throw DriverError.notSupported(context.options.type);
    }
}
```

### Singleton registry pattern (data sources, factories, env)

State that must survive across calls in the same process is stored in module-local `Record`s, with `set*` / `has*` / `use*` / `unset*` (and sometimes `reset*`) functions:

- `src/data-source/singleton.ts` → `instances`, `initializePromises`, `optionsPromises`
- `src/env/module.ts` → single `instance` cache, with `resetEnv()`
- `src/seeder/factory/manager.ts` → `SeederFactoryManager.items` keyed by entity name

`useEnv()` is cached on first read; tests that mutate `process.env` must call `resetEnv()` between cases.

### CommandModule pattern (CLI)

Each command is a class implementing yargs' `CommandModule` interface (see `src/cli/commands/database/create.ts`). The classes are **public exports** — consumers can pull `DatabaseCreateCommand` into their own yargs pipeline. The CLI entry just instantiates and registers them:

```ts
// src/cli/index.ts
yargs(hideBin(process.argv))
    .scriptName('typeorm-extension')
    .command(new DatabaseCreateCommand())
    .command(new DatabaseDropCommand())
    .command(new SeedRunCommand())
    .command(new SeedCreateCommand())
    .strict()
    .parse();
```

### Factory pattern (seeder/factory)

`setSeederFactory(Entity, callback)` registers a faker-driven generator with the global `SeederFactoryManager`. A `Seeder.run(dataSource, factoryManager)` impl calls `factoryManager.get(Entity).createMany(n)`. The factory `callback` receives a `Faker` instance from `@faker-js/faker` (peer dep — only loaded when factories are actually used).

## Data Flow

### Create / Drop database

```
Input:
  └── DataSourceOptions (passed in) or env vars / discovered data-source file

Processing:
  1. buildDatabaseXContext() resolves options + flags
  2. switch on context.options.type → driver function
  3. driver opens a raw native client (bypassing TypeORM init)
  4. driver runs CREATE/DROP SQL
  5. (create only) optionally synchronizes the schema after creation

Output:
  └── driver-native result (Promise<unknown>) — caller usually ignores it
```

### Seeder execution

```
Input:
  └── DataSource + SeederOptions { seeds, factories, seedName?, seedTracking? }

Processing:
  1. SeederExecutor.buildOptions() merges options ← dataSource.options ← env ← defaults
  2. (optional) prepareSeederFactories() loads factory files via glob → registers in manager
  3. prepareSeederSeeds() loads seed files via glob → constructs entities
  4. If tracking: create `seeds` table if missing, load already-executed names
  5. Filter to pending = (matches seedName?) AND (not already tracked OR not tracking)
  6. For each pending: instantiate, call .run(dataSource, factoryManager), optionally insert tracking row

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
- `DriverError` (e.g. `DriverError.notSupported(type)`) is thrown by the database-methods `switch` default arm and by driver utility code.
- `OptionsError` is thrown when the context builder cannot resolve a DataSource / options.
- Anywhere else, library code lets the underlying error (TypeORM, the native driver, faker, file-system) propagate. **Do not wrap errors just to add a message** — wrap only when you need a typed error the caller can catch.

## File Structure (architecture → paths)

```text
Public entry             → src/index.ts
CLI entry                → src/cli/index.ts          (bundled to bin/cli.{cjs,mjs})
Database create/drop     → src/database/methods/{create,drop,check}/module.ts
Per-driver SQL           → src/database/driver/<driver>.ts
Context builders         → src/database/utils/context.ts
Schema sync after create → src/database/utils/schema.ts
DataSource registry      → src/data-source/singleton.ts
DataSource discovery     → src/data-source/find/module.ts
DataSource options merge → src/data-source/options/module.ts + utils/{env,merge}.ts
Seeder runtime           → src/seeder/executor.ts, src/seeder/module.ts
Factory registry         → src/seeder/factory/manager.ts
Query applier            → src/query/module.ts
Per-parameter appliers   → src/query/parameter/<concern>/module.ts
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
