<p align="center">
  <img src=".github/assets/logo.svg" alt="typeorm-extension logo: a sky-blue extension piece clicking into a slate database piece" width="120">
</p>

<h1 align="center">typeorm-extension</h1>

<p align="center">
  <strong>Create, migrate, check, lock and seed TypeORM databases on every driver, from code or the CLI.</strong><br>
  Stop writing per-dialect <code>CREATE DATABASE</code> scripts, hand-rolled advisory locks and driver error-code switches.
</p>

<p align="center">
  <a href="https://badge.fury.io/js/typeorm-extension"><img src="https://badge.fury.io/js/typeorm-extension.svg" alt="npm version"></a>
  <a href="https://codecov.io/gh/Tada5hi/typeorm-extension"><img src="https://codecov.io/gh/Tada5hi/typeorm-extension/branch/master/graph/badge.svg?token=4KNSG8L13V" alt="codecov"></a>
  <a href="https://github.com/Tada5hi/typeorm-extension"><img src="https://github.com/Tada5hi/typeorm-extension/workflows/CI/badge.svg" alt="Master Workflow"></a>
  <a href="https://snyk.io/test/github/Tada5hi/typeorm-extension?targetFile=package.json"><img src="https://snyk.io/test/github/Tada5hi/typeorm-extension/badge.svg?targetFile=package.json" alt="Known Vulnerabilities"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white" alt="Conventional Commits"></a>
</p>

<p align="center">
  <a href="#why-typeorm-extension">Why</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#cli">CLI</a> ·
  <a href="#database">Database</a> ·
  <a href="#locks">Locks</a> ·
  <a href="#error-classification">Errors</a> ·
  <a href="#seeding">Seeding</a> ·
  <a href="#api">API</a> ·
  <a href="https://typeorm-extension.tada5hi.net">Docs</a>
</p>

---

## Why typeorm-extension?

TypeORM maps your entities and runs your migrations. It stops at the edges of a real deployment: the database has to
exist before the first connection, several replicas start at once, the migrations and `synchronize()` can describe
different schemas, and every driver reports a duplicate key in its own way. typeorm-extension covers those edges for
`postgres`, `cockroachdb`, `mysql`, `mariadb`, `mssql`, `oracle`, `mongodb` and `better-sqlite3`.

| Concern | Without it | With it |
|---------|------------|---------|
| **The database exists** | Connect to a server-level database and run each dialect's own `CREATE DATABASE` (postgres needs an initial database, better-sqlite3 is a file). | `createDatabase()` or `db create`. Skips an existing database, then runs the migrations or `synchronize()`. |
| **Several replicas migrate** | Each replica runs the migrations at boot, or you hand-roll `pg_advisory_lock` / `GET_LOCK` and their different return values. | `withDatabaseLock(queryRunner, 'migrations', fn)`: one session at a time, released also when `fn` throws. |
| **Migrations drift from the entities** | Noticed when the next generated migration suddenly contains unrelated changes. | `assertSchemaMatchesMetadata()` or `db drift` fails the deploy and lists the reconciling statements. |
| **Repair migrations** | Rename statements differ per dialect, and a half-applied migration fails on the rerun. | `renameIndex`, `renameForeignKey`, `changeColumnType` check the current state first and return `false` when already applied. |
| **Read-modify-write races** | Two requests read the same row, both pass the check, both write. | `withLockedEntity()` reads the row with a write lock (`FOR UPDATE`, `UPDLOCK` on mssql) inside a transaction. |
| **A failed write** | Read `code`, `number` or `errorNum`, on the error or on its `driverError`, depending on the driver. | `isDatabaseUniqueViolationError(e)` and its siblings know where each driver puts the vendor code. |
| **Development and test data** | Ad-hoc scripts that insert rows and break on the second run. | Seeder classes and factories, run by `seed run`, optionally tracked so each seeder runs once. |
| **Finding the DataSource** | Every script imports and initializes its own instance. | `data-source.ts` is discovered, and `useDataSource()` initializes it lazily, per alias. |

Create the database once per deployment (`db create` in a release step, so replicas do not race to create it), then let every replica run:

```typescript
import { DataSource } from 'typeorm';
import {
    assertSchemaMatchesMetadata,
    runSeeders,
    withDatabaseLock,
} from 'typeorm-extension';
import { options } from './data-source';

// initialize() must not touch the schema: that happens under the lock below
const dataSource = new DataSource({
    ...options,
    migrationsRun: false,
    synchronize: false,
    dropSchema: false,
});
await dataSource.initialize();

const queryRunner = dataSource.createQueryRunner();
try {
    // one replica at a time, the others wait for the lock
    await withDatabaseLock(queryRunner, 'migrations', async () => {
        await dataSource.runMigrations();
        await assertSchemaMatchesMetadata(dataSource);
        await runSeeders(dataSource, { seedTracking: true });
    });
} finally {
    await queryRunner.release();
}
```

**Table of Contents**
- [Why typeorm-extension?](#why-typeorm-extension)
- [Installation](#installation)
- [Documentation](#documentation)
- [Usage](#usage)
  - [CLI](#cli)
    - [Options](#cli-options)
    - [Examples](#cli-examples)
  - [Database](#database)
    - [Create](#create)
    - [Drop](#drop)
    - [Check](#check)
    - [Schema Drift](#schema-drift)
    - [Generate Migration](#generate-migration)
    - [Repair Migrations](#repair-migrations)
  - [Locks](#locks)
    - [Advisory Lock](#advisory-lock)
    - [Row Lock](#row-lock)
  - [Error Classification](#error-classification)
  - [Instances](#instances)
    - [Single](#single)
    - [Multiple](#multiple)
  - [Seeding](#seeding)
    - [Configuration](#configuration)
    - [Entity](#entity)
    - [Factory](#factory)
    - [Seed](#seed)
    - [Execute](#execute)
  - [Query](#query)
- [API](#api)
- [Notes](#notes)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install typeorm-extension typeorm --save
```

`typeorm` is a peer dependency and is required in the range `^1.1.3` (TypeORM 0.3 is not supported). Install the
native client of your driver as usual (`pg`, `mysql2`, `mssql`, `oracledb`, `mongodb`, `better-sqlite3`). The legacy
`sqlite` driver was removed in TypeORM 1.0, use `better-sqlite3`.

The package is ESM-only and needs Node.js `>=22.0.0`. CommonJS projects can still `require('typeorm-extension')`
through Node's `require(esm)` support, which is enabled by default from Node.js 22.12 (earlier 22.x releases need
`--experimental-require-module`, or a dynamic `import()`).

Seeder factories generate their data with a library of your choice, so nothing else is required. The examples below
use [faker](https://fakerjs.dev/guide/) (`npm install @faker-js/faker`).

## Documentation

To read the docs, visit [https://typeorm-extension.tada5hi.net](https://typeorm-extension.tada5hi.net)

## Usage

### CLI

The following commands are available in the terminal:
- `typeorm-extension db create` to create the database
- `typeorm-extension db drop` to drop the database
- `typeorm-extension db drift` to assert that the database schema matches the entity metadata
- `typeorm-extension seed run` to seed the database
- `typeorm-extension seed create` to create a new seeder

The legacy colon-form (`db:create`, `db:drop`, `seed:run`, `seed:create`) is still accepted for backwards compatibility.

If the application has not yet been built and you want to run the CLI against TypeScript sources directly, invoke the ESM bundle with a TypeScript-aware Node loader (e.g. `tsx` or Node's `--experimental-strip-types`):

```
"scripts": {
    "db:create":   "tsx ./node_modules/typeorm-extension/bin/cli.mjs db create",
    "db:drop":     "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drop",
    "db:drift":    "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift",
    "seed:run":    "tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run",
    "seed:create": "tsx ./node_modules/typeorm-extension/bin/cli.mjs seed create"
}
```

Read the [Seeding Configuration](#configuration) section to find out how to specify the path,
for the seeder- & factory-location.

#### CLI Options

| Option                  | Commands                                          | Default         | Description                                                                                                                                                                                                                           |
|-------------------------|---------------------------------------------------|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `process.cwd()` | Root directory of the project.                                                                                                                                                                                                        |
| `--tsconfig` or `-tc`   | `db create`, `db drift`, `db drop`, `seed run` | `tsconfig.json` | Name (or relative path incl. name) of the tsconfig file.                                                                                                                                                                              |
| `--dataSource` or `-d`  | `db create`, `db drift`, `db drop`, `seed run` | `data-source`   | Name (or relative path incl. name) of the data-source file.                                                                                                                                                                           |
| `--synchronize` or `-s` | `db create`                                       | `yes`           | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                      |
| `--initialDatabase`     | `db create`                                       | `undefined`     | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--skipWithoutMigrations` | `db drift`                                      | `false`         | Report no drift if the data-source has no migrations registered.                                                                                                                                                                      |
| `--name` or `-n`        | `seed create` (required), `seed run` (optional)   | `undefined`     | Name (or relative path incl. name) of the seeder. Required on `seed create`; on `seed run` restricts execution to the matching seeder.                                                                                                |
| `--timestamp` or `-t`   | `seed create`                                     | `Date.now()`    | Custom timestamp used in the generated seeder filename.                                                                                                                                                                               |
| `--javascript` or `-j`  | `seed create`                                     | `false`         | Generate a seeder file for JavaScript instead of TypeScript.                                                                                                                                                                          |
| `--preserveFilePaths`   | `db create`, `db drift`, `db drop`, `seed run` | `false`         | This option indicates if file paths should be preserved and treated as if the just-in-time compilation environment is detected.                                                                                                       |
| `--log-level`           | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `info`          | Logger verbosity. One of `silent`, `info`, `debug`.                                                                                                                                                                                   |

#### CLI Examples
**`Database Create`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs db create  -d src/data-source.ts
```
**`Database Drop`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs db drop  -d src/data-source.ts
```

**`Database Drift`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift  -d src/data-source.ts
```

**`Seed Run`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run  -d src/data-source.ts
```

**`Seed Run Explicit`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run  -d src/data-source.ts --name src/database/seeds/user.ts
```

**`Seed Create`**
```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed create  --name src/database/seeds/user.ts
```

### Database
An alternative to the CLI variant, is to `create` the database in the code base during the runtime of the application.
Therefore, provide the `DataSourceOptions` for the DataSource manually, or let it be created automatically:

#### Create
**`Example #1`**
```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

(async () => {
    const options: DataSourceOptions = {
        type: 'better-sqlite3',
        database: 'db.sqlite'
    };

    // Create the database with specification of the DataSource options
    await createDatabase({
        options
    });

    const dataSource = new DataSource(options);
    await dataSource.initialize();
    // do something with the DataSource
})();
```

**`Example #2`**
```typescript
import { DataSource } from 'typeorm';
import {
    buildDataSourceOptions,
    createDatabase
} from 'typeorm-extension';

(async () => {
    const options = await buildDataSourceOptions();

    // modify options

    // Create the database with specification of the DataSource options
    await createDatabase({
        options
    });

    const dataSource = new DataSource(options);
    await dataSource.initialize();
    // do something with the DataSource
})();
```

**`Example #3`**

It is also possible to let the library automatically search for the data-source under the hood.
Therefore, it will search by default for a `data-source.{ts,js}` file in the following directories:
- `{src,dist}/db/`
- `{src,dist}/database`
- `{src,dist}`

```typescript
import { createDatabase } from 'typeorm-extension';

(async () => {
    // Create the database without specifying it manually
    await createDatabase();
})();
```


To get a better overview and understanding of the
[createDatabase](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#createdatabase)
function, check out the documentation.

#### Drop

**`Example #1`**
```typescript
import {
    DataSource,
    DataSourceOptions
} from 'typeorm';
import { dropDatabase } from 'typeorm-extension';

(async () => {
    const options: DataSourceOptions = {
        type: 'better-sqlite3',
        database: 'db.sqlite'
    };

    // Drop the database with specification of the DataSource options
    await dropDatabase({
        options
    });
})();
```

**`Example #2`**
```typescript
import {
    buildDataSourceOptions,
    dropDatabase
} from 'typeorm-extension';

(async () => {
    const options = await buildDataSourceOptions();

    // modify options

    // Drop the database with specification of the DataSource options
    await dropDatabase({
        options
    });
})();
```

**`Example #3`**

It is also possible to let the library automatically search for the data-source under the hood.
Therefore, it will search by default for a `data-source.{ts,js}` file in the following directories:
- `{src,dist}/db/`
- `{src,dist}/database`
- `{src,dist}`

```typescript
import { dropDatabase } from 'typeorm-extension';

(async () => {
    // Drop the database without specifying it manually
    await dropDatabase();
})();
```

To get a better overview and understanding of the
[dropDatabase](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#dropdatabase)
function, check out the documentation.

#### Check

Ask whether the database exists and whether its schema is current, without changing anything.

```typescript
import { checkDatabase } from 'typeorm-extension';

(async () => {
    const { exists, schema, migrationsPending } = await checkDatabase({
        options
    });
})();
```

A missing database is reported as `exists: false`, and so is any failure to connect (also wrong credentials or an
unreachable host). On mongodb, which creates a database lazily, `exists` is `true` once the connection succeeds, and
`schema` is `true` when no migrations are configured.

A data source passed as `dataSource` takes precedence over `options`. It and a registered one follow the same rule:
an initialized one is used as is and never destroyed, an uninitialized one is left untouched and the check runs on a
copy. A copy never synchronizes, runs migrations or drops the schema.

To get a better overview and understanding of the
[checkDatabase](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#checkdatabase)
function, check out the documentation.

#### Schema Drift

Compare the database schema against the entity metadata and get back the statements which would reconcile them.

Run it right after the migrations to close the blind spot of a project which builds its schema with migrations in
production but with `synchronize()` in tests: the two descriptions can drift apart silently, and it only surfaces
when the next generated migration reconciles them.

```typescript
import { assertSchemaMatchesMetadata, getSchemaDrift } from 'typeorm-extension';

(async () => {
    const drift = await getSchemaDrift(dataSource);
    if (drift.exists) {
        console.log(drift.up.map((statement) => statement.query));
    }

    // ... or let it throw a SchemaDriftError listing the statements
    await assertSchemaMatchesMetadata(dataSource);
})();
```

The same check is available on the command line as `typeorm-extension db drift`, which exits with code `1` on drift.

#### Generate Migration

`generateMigration` writes a migration file from the same schema comparison, using typeorm's own statements and file
templates. The data source must already be initialized.

```typescript
import { generateMigration } from 'typeorm-extension';

(async () => {
    await generateMigration({
        dataSource,
        name: 'add-role',
        directoryPath: 'src/migrations',
    });
})();
```

The file is written as `<timestamp>-<name>.<language>`, by default into `migrations/`. Set `language: 'js'` (plus
`esm: true` for `export class` syntax) for a JavaScript migration, or `preview: true` to receive the statements without
writing a file.

#### Repair Migrations

Renaming a constraint is dialect-asymmetric and easy to get wrong. These helpers read the current state back from the
database, apply the change only if it is still pending, and return whether they did something. That way a repair migration
stays resumable (mysql commits DDL regardless of the surrounding transaction) and safe to run against a database which
never had the drift.

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { changeColumnType, renameForeignKey, renameIndex } from 'typeorm-extension';

export class RepairSchema1700000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await renameIndex(queryRunner, {
            table: 'auth_events',
            from: 'IDX_auth_events_actor_name',
            to: 'IDX_9f6d1a2b3c4d5e6f70819293',
        });

        await renameForeignKey(queryRunner, {
            table: 'auth_permissions',
            from: 'FK_auth_permissions_client',
            to: 'FK_1a2b3c4d5e6f708192a3b4c5',
        });

        await changeColumnType(queryRunner, {
            table: 'auth_permissions',
            column: 'client_id',
            from: { type: 'varchar', length: 36 },
            to: { type: 'varchar', length: 255 },
        });
    }

    public async down(): Promise<void> {
        // a repair has nothing to undo
    }
}
```

`renameIndex` and `renameForeignKey` support `postgres`, `cockroachdb`, `mysql` and `mariadb` and throw a `DriverError`
on any other driver. `changeColumnType` and `withForeignKeyChecksDisabled` work everywhere: `changeColumnType` alters
the column in place (keeping its values) on every relational driver but sqlite, which typeorm handles safely by
recreating the table.

Each helper returns `false` when the change is already applied, which keeps a repair migration resumable. If the
database is in **neither** the expected nor the desired state it raises a `SchemaAlterationError` instead of returning
quietly, since a repair migration which repairs nothing would otherwise pass for a successful one. Pass
`strict: false` per call to opt out.

### Locks

#### Advisory Lock

`withDatabaseLock(queryRunner, name, fn, { timeout })` runs `fn` while holding a named advisory lock (`postgres`,
`mysql`, `mariadb`), for example so only one replica runs the migrations (with `migrationsRun` off, since
`initialize()` would run them before the lock is taken):

```typescript
import { withDatabaseLock } from 'typeorm-extension';

const queryRunner = dataSource.createQueryRunner();
try {
    await withDatabaseLock(queryRunner, 'migrations', () => dataSource.runMigrations());
} finally {
    await queryRunner.release();
}
```

The lock belongs to the session of the query runner. It is released afterwards, also when `fn` throws, and a
transaction `fn` leaves open is rolled back first. Nested calls with the same name on the same query runner do not
block. If the release itself fails, the session is ended instead of going back to the pool, which frees the lock; the
query runner can not be used any further then.

| Option    | Type      | Default | Description                                                                                                   |
|-----------|-----------|---------|---------------------------------------------------------------------------------------------------------------|
| `timeout` | `number`  | unset   | How long to wait for the lock, in milliseconds. `0` tries once, unset waits until the lock is free.            |
| `strict`  | `boolean` | `true`  | Throw a `DriverError` on a driver without advisory locks. `false` runs `fn` without a lock there (e.g. sqlite in tests). |

A lock which can not be acquired within `timeout` raises a `DatabaseLockError`, and so does a query runner which is
already in a transaction.

#### Row Lock

`withLockedEntity(source, Entity, where, fn)` reads one row with a write lock inside a transaction and hands it to
`fn`, so concurrent callers for the same row take turns (`postgres`, `cockroachdb`, `mysql`, `mariadb`, `oracle`,
`mssql`; `isRowLockSupported(source)` tells whether a driver is one of them). It resolves what `fn` returns, or `null` when
no row matches:

```typescript
import { withLockedEntity } from 'typeorm-extension';

const published = await withLockedEntity(dataSource, Post, { id }, async (post, manager) => {
    if (post.status !== 'draft') {
        return false;
    }

    post.status = 'published';
    await manager.save(post);

    return true;
});
```

When the helper opens the transaction (it was given a `DataSource`, or an entity manager outside a transaction), a
throw in `fn` rolls it back. An entity manager which is already in a transaction is reused instead: a nested call locks
a second row within the outer transaction, and a throw only rolls back if the outer caller lets it propagate.

| Option     | Type       | Default            | Description                                                                                                  |
|------------|------------|--------------------|--------------------------------------------------------------------------------------------------------------|
| `onLocked` | `'nowait'` | wait for the row   | Fail at once with the driver's error (recognized by `isDatabaseLockConflictError`). Not supported on mssql.  |
| `strict`   | `boolean`  | `true`             | Throw a `DriverError` on a driver without row locks. `false` runs `fn` without a lock there (e.g. sqlite in tests). |

### Error Classification

`isDatabaseUniqueViolationError(error)`, `isDatabaseForeignKeyViolationError(error)` and `isDatabaseLockConflictError(error)`
classify a failed write whichever driver raised it, e.g. to answer a duplicate key with a conflict rather than a
server error:

```typescript
import { isDatabaseUniqueViolationError } from 'typeorm-extension';

try {
    await dataSource.getRepository(User).insert({ name: 'admin' });
} catch (e) {
    if (isDatabaseUniqueViolationError(e)) {
        throw new ConflictError('The name is already taken.');
    }

    throw e;
}
```

| Function                             | True for                                                                       |
|--------------------------------------|--------------------------------------------------------------------------------|
| `isDatabaseUniqueViolationError`     | a duplicate unique key or primary key (`23505`, `ER_DUP_ENTRY`, mssql `2627` / `2601`, `ORA-00001`, mongodb `11000`) |
| `isDatabaseForeignKeyViolationError` | a missing referenced row, or the delete of a row which is still referenced     |
| `isDatabaseLockConflictError`        | a deadlock victim, a serialization failure or a lock wait that gave up (also `onLocked: 'nowait'`) |

`readDatabaseErrorCode(error)` returns the driver's code as a plain token (`23505`, `ER_DUP_ENTRY`, `2627`, ...) for
logging, never a message which could quote stored values.

To get a better overview and understanding of these functions, check out the
[documentation](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html).

### Instances

#### Single

The default DataSource instance can be acquired, by not providing any alias at all or using the key `default`.
If no DataSource instance or DataSourceOptions object is deposited initially the method will attempt to locate and load
the DataSource file and initialize itself from there.

```typescript
import { DataSource } from 'typeorm';
import { useDataSource } from 'typeorm-extension';

(async () => {
    const dataSource : DataSource = await useDataSource();
})();
```

Reference(s):
- [setDataSource](https://typeorm-extension.tada5hi.net/guide/datasource-api-reference.html#setdatasource)
- [useDataSource](https://typeorm-extension.tada5hi.net/guide/datasource-api-reference.html#usedatasource)

#### Multiple

It is also possible to manage multiple DataSource instances.
Therefore, each additional DataSource must be registered under a different alias.
This can be done by either setting the DataSource instance or the DataSourceOptions object for the given alias.

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { setDataSource, useDataSource } from 'typeorm-extension';

(async () => {
    const secondDataSourceOptions : DataSourceOptions = {
        // ...
    };

    const dataSource = new DataSource(secondDataSourceOptions);
    setDataSource(dataSource, 'second');

    const instance : DataSource = await useDataSource('second');
})();
```

Reference(s):
- [setDataSource](https://typeorm-extension.tada5hi.net/guide/datasource-api-reference.html#setdatasource)
- [setDataSourceOptions](https://typeorm-extension.tada5hi.net/guide/datasource-api-reference.html#setdatasourceoptions)

### Seeding

Seeding the database is fairly easy and can be achieved by following the steps below:
- `Configuration`: Specify the seed and factory location by path or object.
- `Entity`: Define one or more entities.
- `Factory` (optional): Define a factory for each entity for which data should be automatically generated.
- `Seed`: Define one or more seed classes to populate the database with an initial data set or generated data by a factory.
- `Execute`: Run the seeder(s) with the CLI or in the code base.

#### Configuration

Seeder paths are configured as **glob patterns**, making it easy
to match all the factory/seeder files in your project without configuration effort:
- use `*` to match anything except slashes and hidden files
- use `**` to match zero or more directories
- use comma separate values between `{}` to match against a list of options

Check out the [glob](https://www.npmjs.com/package/glob) documentation for other supported pattern features.
It is important to use the posix/unix path separator (/) because
the Windows path separator (\\) is used to match paths with literal global pattern characters.

The seeder- & factory-location, can be specified via:
- `environment` variable(s)
- extended `data-source.ts` file
- `runSeeder(s)` method options parameter, in case of a direct code base usage

The following values are assumed by default:
- factory path: `src/database/factories/**/*{.ts,.js}`
- seed path: `src/database/seeds/**/*{.ts,.js}`

Note: When seeder paths are configured as **glob patterns**, the paths are resolved and sorted in alphabetical order using filenames. This helps to ensure that the seeders are executed in the correct order.

Seeder options can be provided per invocation (`runSeeder(s)` options parameter), on the extended
data-source options, or via environment variables. Explicit input wins over the data-source options,
which win over the environment; built-in defaults apply last.

It is possible to define that a seeder is only executed once.
This can either be set globally using the `seedTracking` option or locally using the `track` property of a seeder class.
Executed seeds are recorded in a `seeds` table (a collection for MongoDB);
the table name can be changed with the `seedTableName` option.

`data-source.ts`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
    type: 'better-sqlite3',
    database: 'db.sqlite',

    seeds: ['src/database/seeds/**/*{.ts,.js}'],
    seedTracking: false,
    factories: ['src/database/factories/**/*{.ts,.js}'],
};

export const dataSource = new DataSource(options);
```

`runSeeder(s)`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';

(async () => {
    const options: DataSourceOptions = {
        type: 'better-sqlite3',
        database: 'db.sqlite',
    };

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    runSeeders(dataSource, {
        seeds: ['src/database/seeds/**/*{.ts,.js}'],
        factories: ['src/database/factories/**/*{.ts,.js}']
    });
})();
```

#### Entity
To get started, define one or more entities.

**`user.ts`**
```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column
} from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    firstName: string

    @Column()
    lastName: string

    @Column()
    email: string
}
```

#### Factory
To create entities with random data, create a factory for each desired entity.
The definition of a factory is **optional**.

The factory callback returns the entity to persist. Pick any data generator you like and import it in the
factory file. The examples use [faker](https://fakerjs.dev/guide/) (`npm install @faker-js/faker`).

**`user.factory.ts`**
```typescript
import { faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';
import { User } from './user';

export default setSeederFactory(User, () => {
    const user = new User();
    user.firstName = faker.person.firstName('male');
    user.lastName = faker.person.lastName('male');
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });

    return user;
})
```

Since the generator instance belongs to the factory file, locales and reproducible runs are configured
through the generator's own API, for example `import { fakerDE as faker } from '@faker-js/faker'`
or `faker.seed(1234)`.

#### Seed
And last but not least, create a seeder. The seeder can be called by the cli command `seed:run` or in the codebase
by using the function `runSeeder` / `runSeeders`.
A seeder class only requires one method, called `run` and provides the arguments `dataSource` & `factoryManager`.

**`user.seeder.ts`**

A seeder class must implement the [Seeder](https://typeorm-extension.tada5hi.net/guide/seeding-api-reference.html) interface, and could look like this:

```typescript
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from './user';

export default class UserSeeder implements Seeder {
    /**
     * Track seeder execution.
     *
     * Default: false
     */
    track = false;

    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<any> {
        const repository =  dataSource.getRepository(User);
        await repository.insert([
            {
                firstName: 'Caleb',
                lastName: 'Barrows',
                email: 'caleb.barrows@gmail.com'
            }
        ]);

        // ---------------------------------------------------

        const userFactory = await factoryManager.get(User);
        // save 1 factory generated entity, to the database
        await userFactory.save();

        // save 5 factory generated entities, to the database
        await userFactory.saveMany(5);
    }
}
```

Factories obtained through the `factoryManager` argument are bound to the data source of the
current seeder run, so `save()` and `saveMany()` persist there. A factory used outside a seeder
run falls back to the data source registered for the `default` alias.

#### Execute

Populate the database from the code base:

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { User } from './user';

(async () => {
    const options: DataSourceOptions & SeederOptions = {
        type: 'better-sqlite3',
        database: 'db.sqlite',
        entities: [User],

        seeds: ['./*.seeder.ts'],
        factories: ['./*.factory.ts']
    };

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    await runSeeders(dataSource);
})();
```

Populate the database by explicit definitions from the codebase.

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { User } from './user';
import UserSeeder from './user.seeder';
import UserFactory from './user.factory';

(async () => {
    const options: DataSourceOptions & SeederOptions = {
        type: 'better-sqlite3',
        database: 'db.sqlite',
        entities: [User],

        seeds: [UserSeeder],
        factories: [UserFactory]
    };

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    await runSeeders(dataSource);
})();
```

### Query

The query submodule (`applyQuery`, `applyFilters`, ...) was removed in v4.
Its successor is [@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm), the dedicated
TypeORM adapter of the [rapiq](https://github.com/tada5hi/rapiq) v2 monorepo. The query pipeline is now fully
**self-contained** in rapiq: decoding the raw URL query string (`@rapiq/codec-url`), typed schema
validation (`@rapiq/core`) and application onto the `SelectQueryBuilder` (`@rapiq/adapter-typeorm`).
`typeorm-extension` is no longer involved. On top of the full `applyQuery` use case it adds typed
schemas, nested `and` / `or` filter compounds, the `contains` operator family and collision-free join aliases.

The [monorepo](https://github.com/tada5hi/rapiq) hosts more than the TypeORM adapter: adapters for
drizzle, prisma, raw SQL and in-memory collections, plus pluggable input parsers (e.g. a MongoDB-style
filter parser and an expression parser). If rapiq is useful to you, consider giving the repo a ⭐ on GitHub.

```bash
npm install @rapiq/core @rapiq/codec-url @rapiq/adapter-typeorm --save
```

For demonstration purposes, two simple entities with a relation between them are used:

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    OneToOne,
    JoinColumn
} from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 30})
    @Index({unique: true})
    name: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    email: string;

    @OneToOne(() => Profile)
    profile: Profile;
}

@Entity()
export class Profile {
    @PrimaryGeneratedColumn({unsigned: true})
    id: number;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    avatar: string;

    @Column({type: 'varchar', length: 255, default: null, nullable: true})
    cover: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User;
}
```

Instead of passing loose options per call (as `applyQuery` did), the allowed query features are declared
once as a typed **schema** and registered alongside a codec:

```typescript
import { SchemaRegistry, defineSchema } from '@rapiq/core';
import { createURLCodec } from '@rapiq/codec-url';
import { Profile, User } from './entities';

const registry = new SchemaRegistry();

registry.add(defineSchema<Profile>({
    name: 'profile',
    fields: { allowed: ['id', 'avatar'] },
    filters: { allowed: ['id'] },
}));

registry.add(defineSchema<User>({
    name: 'user',
    fields: {
        allowed: ['id', 'name', 'email'],
        default: ['id', 'name'],
    },
    filters: { allowed: ['id', 'name', 'profile.id'] },
    relations: { allowed: ['profile'] },
    sort: { allowed: ['id', 'name'], default: { id: 'DESC' } },
    pagination: { maxLimit: 20 },
    schemaMapping: { profile: 'profile' },
}));

export const codec = createURLCodec(registry);
```

The codec owns both directions. A client builds the query string with `encode`, from a typed query
instead of string concatenation (no registry needed on the client):

```typescript
import { defineQuery } from '@rapiq/core';
import { createURLCodec } from '@rapiq/codec-url';
import type { User } from './entities';

const codec = createURLCodec();

const query = defineQuery<User>({
    fields: ['id', 'name'],
    filters: { id: 1 },
    relations: ['profile'],
    pagination: { limit: 10, offset: 0 },
});

const response = await fetch(`/users?${codec.encode(query)}`);
```

The request handler then decodes the raw query parameters against the schema and lets the adapter apply
the result onto the query builder. It is shown here with [express](https://www.npmjs.com/package/express),
but the flow is framework-agnostic:

```typescript
import { ParseError } from '@rapiq/core';
import { TypeormAdapter } from '@rapiq/adapter-typeorm';
import { useDataSource } from 'typeorm-extension';
import { codec } from './codec';
import { User } from './entities';

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=profile&filter[id]=1&fields[user]=id,name
 */
app.get('/users', async (req, res) => {
    let query;
    try {
        query = codec.decode(req.query, { schema: 'user' });
    } catch (e) {
        // e.g. a malformed filter expression
        if (e instanceof ParseError) {
            return res.status(400).json({ error: e.message });
        }
        throw e;
    }
    if (!query) {
        return res.status(400).json({ error: 'Invalid query input.' });
    }

    const dataSource = await useDataSource();
    const queryBuilder = dataSource.getRepository(User).createQueryBuilder('user');

    const { pagination } = new TypeormAdapter({ queryBuilder }).execute(query);

    const [entities, total] = await queryBuilder.getManyAndCount();

    res.json({
        data: entities,
        meta: {
            total,
            ...pagination
        }
    });
});
```

A production-shaped version with strict schema-violation handling (`throwOnFailure`) is in the
[Express + TypeORM recipe](https://rapiq.tada5hi.net/guide/recipes/express-typeorm); the client side is covered by the
[frontend recipe](https://rapiq.tada5hi.net/guide/recipes/frontend).

To move over from the removed submodule, follow the migration guide:
[https://rapiq.tada5hi.net/guide/migration-typeorm-extension](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)

> **Note**: This section is kept during the v4 release cycle to route former `applyQuery` users to the
> successor. With the next major release (v5) it will be removed from the README and docs; the
> [rapiq documentation](https://rapiq.tada5hi.net) is the canonical reference.

## API

Everything below is exported from `typeorm-extension`. The [API reference](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html) on the
docs site has the signatures and option types.

| Area | Exports | Reference |
|------|---------|-----------|
| Database | `createDatabase`, `dropDatabase`, `checkDatabase`, `synchronizeDatabaseSchema`, `generateMigration` | [Database](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html) |
| Schema | `getSchemaDrift`, `assertSchemaMatchesMetadata`, `renameIndex`, `renameForeignKey`, `changeColumnType`, `withForeignKeyChecksDisabled` | [Database](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#getschemadrift) |
| Locks | `withDatabaseLock`, `withLockedEntity`, `isRowLockSupported` | [Database](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#withdatabaselock) |
| Error classification | `isDatabaseUniqueViolationError`, `isDatabaseForeignKeyViolationError`, `isDatabaseLockConflictError`, `readDatabaseErrorCode` | [Database](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#isdatabaseuniqueviolationerror) |
| Data source | `setDataSource`, `useDataSource`, `hasDataSource`, `unsetDataSource`, `setDataSourceOptions`, `useDataSourceOptions`, `buildDataSourceOptions`, `findDataSource`, `hasEnvDataSourceOptions`, `assertEnvDataSourceOptions` | [DataSource](https://typeorm-extension.tada5hi.net/guide/datasource-api-reference.html) |
| Seeding | `runSeeder`, `runSeeders`, `Seeder`, `setSeederFactory`, `useSeederFactory`, `useSeederFactoryManager`, `resetSeederFactoryManager`, `resolveSeederConfig` | [Seeding](https://typeorm-extension.tada5hi.net/guide/seeding-api-reference.html) |
| Environment | `useEnv`, `resetEnv` (reads the `TYPEORM_*` / `DB_*` variables) | |
| Entity helpers (experimental) | `getEntityName`, `getEntityMetadata`, `getEntityPropertyNames`, `validateEntityJoinColumns`, `isEntityUnique` | [Entity](https://typeorm-extension.tada5hi.net/guide/entity-api-reference.html) |
| Errors | `TypeormExtensionError`, `DriverError`, `OptionsError`, `SchemaDriftError`, `SchemaAlterationError`, `DatabaseLockError`, `EntityMetadataError`, `EntityRelationLookupError` | [Database](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html) |

## Notes

- **`createDatabase` is not a lock.** On postgres and cockroachdb "only if missing" is a lookup followed by a
  `CREATE DATABASE`, so two replicas starting at the same moment can both try to create it. Create the database from one
  place (a deploy step, `db create`) or tolerate the second attempt.
- **Advisory locks exist on postgres, mysql and mariadb only.** cockroachdb accepts postgres' advisory lock functions
  but they lock nothing, so `withDatabaseLock` refuses it with a `DriverError`, like every other driver. Pass
  `strict: false` to run the callback without a lock instead.
- **`withLockedEntity` refuses mongodb**, where typeorm emits no row lock, and `onLocked: 'nowait'` on mssql, which
  typeorm ignores there.
- **A failed lock release ends the session.** The query runner is released then; a caller which catches the error of a
  nested `withDatabaseLock` and carries on runs without the lock.
- **The rename helpers know four dialects.** `renameIndex` and `renameForeignKey` throw a `DriverError` on anything but
  postgres, cockroachdb, mysql and mariadb. `changeColumnType` falls back to typeorm's `changeColumn()` there.
- **`dropDatabase` does nothing on oracle**, and mongodb creates a database lazily, so `checkDatabase` reports it as
  existing once the connection succeeds.
- **Seed tracking is off by default.** Without `seedTracking` (or a seeder's `track = true`) every seeder runs on every
  `seed run`. Seeders found by a glob pattern run in alphabetical order of their file names.
- **The `Query` section is temporary.** It will be removed in v5; the [rapiq documentation](https://rapiq.tada5hi.net) is
  the reference.

## Contributing

Before starting to work on a pull request, it is important to review the guidelines for
[contributing](./CONTRIBUTING.md) and the [code of conduct](./CODE_OF_CONDUCT.md).
These guidelines will help to ensure that contributions are made effectively and are accepted.

## License

Made with 💚

Published under [MIT License](./LICENSE).
