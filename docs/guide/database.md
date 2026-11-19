# Database

This page shows how to create, drop and check a database from code. The CLI equivalents are
[`db create` and `db drop`](./cli).

Related pages: [Schema](./schema) (drift, migrations, repair helpers), [Locks](./locks) (advisory and row locks)
and [Errors](./errors) (classifying driver errors).

## Create

```typescript
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

const options: DataSourceOptions = {
    type: 'better-sqlite3',
    database: 'db.sqlite',
};

await createDatabase({ options });

const dataSource = new DataSource(options);
await dataSource.initialize();
```

`createDatabase` takes the `DataSourceOptions` in one of three ways:

- `options`: the options you pass, as above.
- `options` from `await buildDataSourceOptions()`, which finds the data-source file (or reads the environment) and
  lets you change the result before the call.
- no `options` at all: the data-source file is discovered, as described on the [Data Source](./data-source) page.
  Pass `findOptions` to say where to look.

What happens on the call:

- The database is created only if it does not exist yet (`ifNotExist`, default `true`).
- On postgres, "if it does not exist" is a lookup in `pg_database` followed by `CREATE DATABASE`. Two callers
  running at the same moment can both see no database, and the second `CREATE` fails. Create the database once,
  for example in a release step, not from every replica (see [Deploying with several replicas](./recipes/deploy)).
- With `synchronize` (default `true`) the schema is set up right after, also when the database already existed: the
  migrations run when the options configure any, otherwise `synchronize(false)` runs. Pass `synchronize: false` to
  only create the database.
- The options are used with `synchronize`, `migrationsRun` and `dropSchema` turned off and without subscribers, so
  nothing beyond the step above touches the schema.

For every option, see [createDatabase](./database-api-reference#createdatabase).

## Drop

```typescript
import { buildDataSourceOptions, dropDatabase } from 'typeorm-extension';

const options = await buildDataSourceOptions();

await dropDatabase({ options });
```

- The options can be passed, built or discovered, the same three ways as for `createDatabase`.
- A missing database is not an error (`ifExist`, default `true`).
- On oracle, dropping a database is not supported: the call does nothing.

For every option, see [dropDatabase](./database-api-reference#dropdatabase).

## Check

`checkDatabase` tells setup code whether the database exists and whether its schema is current.
It never synchronizes, migrates or drops the schema.

```typescript
import type { DataSourceOptions } from 'typeorm';
import { checkDatabase, createDatabase } from 'typeorm-extension';

declare const options: DataSourceOptions;

const check = await checkDatabase({ options });

if (!check.exists) {
    await createDatabase({ options });
}
```

The result has three fields:

- `exists`: whether the database exists. A missing database is reported as `false`, on cockroachdb as well.
  Any failure to connect (also wrong credentials or an unreachable host) is reported as `false`. On better-sqlite3,
  connecting creates a missing database file, so `exists` is `true` there.
- `schema`: whether the schema is up to date. With migrations configured, this is `true` when none are pending.
  Without migrations, a database which already has a migrations table counts as up to date only when no entities are
  defined. Otherwise the entity tables are compared against the entity metadata.
- `migrationsPending`: the migrations which have not run yet.

Where the data source comes from:

- Without `options`, the data source is looked up by `alias` in the registry, or discovered the same way as for
  `createDatabase`.
- A data source passed as `dataSource` takes precedence over `options` and `alias`.
- An initialized data source (passed or registered) is used as is and never destroyed. An uninitialized one is left
  untouched and the check runs on a copy.
- A copy, like any data source the check builds itself, never synchronizes, runs migrations or drops the schema,
  and on postgres it installs no extensions.

For details, see [checkDatabase](./database-api-reference#checkdatabase).

::: warning NOTE
mongodb has no schema to compare. Without migrations configured, `schema` is always `true` there, and `exists` is
`true` once the connection succeeds: mongodb creates a database lazily, so a missing one is not reported.
:::

## Custom Connection

By default, the library opens a raw connection with the driver's native client (for example `pg` or `mysql2`) to
run the `CREATE` and `DROP` statements. For server-backed drivers you can inject a server-level connection of your
own instead, such as an existing admin pool or a tunnelled connection.

```typescript
import type { DataSourceOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

declare const options: DataSourceOptions;
declare const pool: { query: (statement: string) => Promise<unknown> };

await createDatabase({
    options,
    connection: {
        execute: (statement) => pool.query(statement),
    },
});
```

- The injected object only needs the `execute` part of the `IDatabaseConnection` interface.
- It is treated as already open: the library never opens or closes it. Its lifecycle stays with you.
- For full control over how connections are opened (for example one per target database), implement the
  `IDatabaseConnectionFactory` interface instead. Both types are exported from the package.

::: warning NOTE
The former per-driver helpers (`createPostgresDatabase`, `dropMySQLDatabase`, ...) are deprecated and will be
removed in the next major release. Use `createDatabase` and `dropDatabase`: the driver is picked from the `type` of
the options. On oracle, dropping a database is not supported and the create statement is passed through unchanged.
:::
