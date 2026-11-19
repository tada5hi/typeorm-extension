# Data Source

This page explains how the library finds your TypeORM data source, how environment variables change its options, and
how you keep several data sources side by side.

## Discovery

The CLI and `useDataSource()` look for a file that exports a TypeORM `DataSource`:

```typescript
// src/database/data-source.ts
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'app',
    password: 'secret',
    database: 'app',
    entities: ['src/database/entities/**/*{.ts,.js}'],
    migrations: ['src/database/migrations/**/*{.ts,.js}'],
    seeds: ['src/database/seeds/**/*{.ts,.js}'],
    factories: ['src/database/factories/**/*{.ts,.js}'],
};

export const dataSource = new DataSource(options);
```

Without `-d`, these paths are tried in order, each with the extensions `.js`, `.cjs`, `.mjs`, `.ts`, `.cts` and
`.mts`:

1. `data-source`
2. `src/data-source`
3. `src/db/data-source` and `src/database/data-source`

- The paths are relative to the current working directory and to the directory of the `-d` file (without `-d`:
  `--root`, which defaults to the current working directory).
- `-d` (`--dataSource`) names another file, e.g. `-d src/config/orm.ts`. The path is relative to `--root`. The
  named file is tried first, and the paths above stay the fallback.
- Unless the process runs under `tsx` or `ts-node`, the library assumes compiled code: `src` in these paths becomes the
  `outDir` of your tsconfig (default `dist`), and `.ts` becomes `.js`. The same rewrite applies to string paths in
  `entities`, `migrations`, `subscribers`, `seeds` and `factories`. Pass `--preserveFilePaths` to turn it off.
- Every export of the file is checked, the default export included. The first one that is a `DataSource`, or a promise
  that resolves to one, is used. A plain options object or a function is not accepted.
- The library only reads the `options` of that `DataSource`. `useDataSource()` creates and initializes a new
  instance from them, so the exported instance stays uninitialized.

An export can be a promise, e.g. when a secret has to be loaded first:

```typescript
import { DataSource } from 'typeorm';

export default (async () => {
    const password = await readSecret('db-password');

    return new DataSource({
        type: 'postgres',
        host: 'localhost',
        username: 'app',
        password,
        database: 'app',
    });
})();
```

::: tip Import types with `import type`
When Node loads a `.ts` file itself (type stripping, on by default since Node 22.18), it removes type annotations but
keeps every import. `import { DataSource, DataSourceOptions } from 'typeorm'` then fails with
`does not provide an export named 'DataSourceOptions'`. Write `import type { DataSourceOptions } from 'typeorm'`.
Node's type stripping also does not support decorators, so files with entities need `tsx` or a build.
:::

In code, `buildDataSourceOptions()` runs the same lookup and `findDataSource()` returns the `DataSource` it finds.

- [`buildDataSourceOptions`](./datasource-api-reference#builddatasourceoptions)
- [`DataSourceFindOptions`](./datasource-api-reference#datasourcefindoptions)
- [CLI options](./cli#options)

## Environment variables

Data source options can also come from environment variables. Each variable has a `DB_*` name and a `TYPEORM_*`
alias. When both are set, the `DB_*` name wins.

```sh
DB_TYPE=postgres
DB_HOST=localhost
DB_USERNAME=app
DB_PASSWORD=secret
DB_DATABASE=app
DB_ENTITIES=dist/database/entities/*.js
```

| Variable                      | Alias                              | Sets                                                    | Format                                          |
|-------------------------------|------------------------------------|---------------------------------------------------------|-------------------------------------------------|
| `DB_TYPE`                     | `TYPEORM_CONNECTION`               | `type`                                                  | string                                          |
| `DB_URL`                      | `TYPEORM_URL`                      | `url`, and `type` from its scheme if `DB_TYPE` is unset | string                                          |
| `DB_HOST`                     | `TYPEORM_HOST`                     | `host`                                                  | string                                          |
| `DB_PORT`                     | `TYPEORM_PORT`                     | `port`                                                  | int                                             |
| `DB_USERNAME`                 | `TYPEORM_USERNAME`                 | `username`                                              | string                                          |
| `DB_PASSWORD`                 | `TYPEORM_PASSWORD`                 | `password`                                              | string                                          |
| `DB_DATABASE`                 | `TYPEORM_DATABASE`                 | `database` (better-sqlite3 default: `db.sqlite`)        | string                                          |
| `DB_SID`                      | `TYPEORM_SID`                      | `sid` (oracle)                                          | string                                          |
| `DB_SCHEMA`                   | `TYPEORM_SCHEMA`                   | `schema` (postgres, cockroachdb, mssql)                 | string                                          |
| `DB_UUID_EXTENSION`           | `TYPEORM_UUID_EXTENSION`           | `uuidExtension` (postgres)                              | string                                          |
| `DB_DRIVER_EXTRA`             | `TYPEORM_DRIVER_EXTRA`             | `extra`                                                 | JSON                                            |
| `DB_SYNCHRONIZE`              | `TYPEORM_SYNCHRONIZE`              | `synchronize`                                           | bool                                            |
| `DB_DROP_SCHEMA`              | `TYPEORM_DROP_SCHEMA`              | `dropSchema`                                            | bool                                            |
| `DB_MIGRATIONS_RUN`           | `TYPEORM_MIGRATIONS_RUN`           | `migrationsRun`                                         | bool                                            |
| `DB_ENTITIES`                 | `TYPEORM_ENTITIES`                 | `entities`                                              | list                                            |
| `DB_MIGRATIONS`               | `TYPEORM_MIGRATIONS`               | `migrations`                                            | list                                            |
| `DB_SUBSCRIBERS`              | `TYPEORM_SUBSCRIBERS`              | `subscribers`                                           | list                                            |
| `DB_MIGRATIONS_TABLE_NAME`    | `TYPEORM_MIGRATIONS_TABLE_NAME`    | `migrationsTableName`                                   | string                                          |
| `DB_METADATA_TABLE_NAME`      | `TYPEORM_METADATA_TABLE_NAME`      | `metadataTableName`                                     | string                                          |
| `DB_ENTITY_PREFIX`            | `TYPEORM_ENTITY_PREFIX`            | `entityPrefix`                                          | string                                          |
| `DB_LOGGING`                  | `TYPEORM_LOGGING`                  | `logging`                                               | bool, `all` or list                             |
| `DB_LOGGER`                   | `TYPEORM_LOGGER`                   | `logger`                                                | string                                          |
| `DB_MAX_QUERY_EXECUTION_TIME` | `TYPEORM_MAX_QUERY_EXECUTION_TIME` | `maxQueryExecutionTime`                                 | int                                             |
| `DB_CACHE`                    | `TYPEORM_CACHE`                    | `cache`                                                 | bool, `redis`, `ioredis`, `ioredis/cluster` or `database` |
| `DB_CACHE_OPTIONS`            | `TYPEORM_CACHE_OPTIONS`            | `cache.options` (with a cache type)                     | JSON                                            |
| `DB_CACHE_ALWAYS_ENABLED`     | `TYPEORM_CACHE_ALWAYS_ENABLED`     | `cache.alwaysEnabled` (with a cache type)               | bool                                            |
| `DB_CACHE_DURATION`           | `TYPEORM_CACHE_DURATION`           | `cache.duration` (with a cache type)                    | int                                             |
| `DB_PIN_TIMEZONE`             | `TYPEORM_PIN_TIMEZONE`             | pins the session timezone, see `pinTimezone`            | `UTC` only                                      |
| `DB_SEEDS`                    | `TYPEORM_SEEDING_SEEDS`            | `seeds`                                                 | list                                            |
| `DB_FACTORIES`                | `TYPEORM_SEEDING_FACTORIES`        | `factories`                                             | list                                            |
| `DB_DEBUG`                    | `TYPEORM_DEBUG`                    | `useEnv('debug')` only, no option                       | string                                          |
| `NODE_ENV`                    |                                    | `useEnv('env')` only (default `development`)            | string                                          |

A list is comma separated. A bool is `true`, `t` or `1`, or `false`, `f` or `0`; any other value counts as unset. A
JSON value that does not parse throws when the environment is read.

How the environment combines with the data source file:

- The environment adds data source options only when it names a driver: `DB_TYPE`, or a `DB_URL` with a scheme.
  Connection settings without a driver are ignored; `assertEnvDataSourceOptions()` throws for that case.
  `DB_PIN_TIMEZONE` applies in either case.
- No file found: the options come from the environment alone. Neither a file nor a driver: `OptionsError`.
- File and environment name the same driver: a set variable wins over the file, and the file fills the rest. `extra`
  and `cache` are merged key by key. `entities`, `migrations` and `subscribers` are joined, the environment's entries
  first.
- File and environment name different drivers: the environment's options are used and the file is ignored.
- `DB_SEEDS` and `DB_FACTORIES` are the fallback: seeds or factories set in the data source options or passed in code
  win.

The library does not load `.env` files. Load one with Node (`node --env-file=.env ...`) or tsx
(`tsx --env-file=.env ...`), or let your shell or process manager set the variables.

`useEnv()` reads the variables once and caches the result. If you change `process.env` afterwards (e.g. in tests), call
`resetEnv()`:

```typescript
import { resetEnv, useEnv } from 'typeorm-extension';

process.env.DB_DATABASE = 'test';
resetEnv();

const database = useEnv('database'); // 'test'
```

- [`hasEnvDataSourceOptions`](./datasource-api-reference#hasenvdatasourceoptions)
- [`assertEnvDataSourceOptions`](./datasource-api-reference#assertenvdatasourceoptions)
- [`pinTimezone`](./datasource-api-reference#pintimezone)

## Multiple instances

The library keeps data sources in a registry under an alias. Without an alias, the alias is `default`.

```typescript
import { DataSource } from 'typeorm';
import {
    hasDataSource,
    setDataSource,
    setDataSourceOptions,
    unsetDataSource,
    useDataSource,
} from 'typeorm-extension';

// 1. a DataSource instance, initialized on first use
setDataSource(new DataSource({
    type: 'postgres',
    host: 'localhost',
    database: 'app',
}));

// 2. only options: the DataSource is created on first use
setDataSourceOptions({
    type: 'better-sqlite3',
    database: 'reports.sqlite',
}, 'reports');

const app = await useDataSource(); // alias 'default'
const reports = await useDataSource('reports');

hasDataSource('reports'); // true

await reports.destroy();
unsetDataSource('reports');
```

- `useDataSource(alias)` returns the registered instance and initializes it if needed. With only options registered,
  it creates the `DataSource` from them.
- With nothing registered for the alias, `useDataSource()` runs the [discovery](#discovery) above, combined with the
  [environment](#environment-variables).
- Concurrent `useDataSource()` calls for one alias share one build, so only one `DataSource` is created and
  initialized. A failed build is not cached; the next call tries again.
- `hasDataSource(alias)` is true once an instance is registered or built. Registered options alone do not count.
- `unsetDataSource(alias)` removes the instance from the registry. It does not destroy it, and registered options
  stay, so the next `useDataSource(alias)` builds a new instance from them.

- [`setDataSource`](./datasource-api-reference#setdatasource)
- [`useDataSource`](./datasource-api-reference#usedatasource)
- [`setDataSourceOptions`](./datasource-api-reference#setdatasourceoptions)
- [`useDataSourceOptions`](./datasource-api-reference#usedatasourceoptions)
