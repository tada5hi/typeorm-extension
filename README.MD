# Typeorm Extension 🚀

[![npm version](https://badge.fury.io/js/typeorm-extension.svg)](https://badge.fury.io/js/typeorm-extension)
[![codecov](https://codecov.io/gh/Tada5hi/typeorm-extension/branch/master/graph/badge.svg?token=4KNSG8L13V)](https://codecov.io/gh/Tada5hi/typeorm-extension)
[![Master Workflow](https://github.com/Tada5hi/typeorm-extension/workflows/CI/badge.svg)](https://github.com/Tada5hi/typeorm-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/typeorm-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/typeorm-extension?targetFile=package.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This is a library to
- `create`, `drop` & `seed` the (default-) database 🔥
- manage one or many data-source instances 👻

**Table of Contents**
- [Installation](#installation)
- [Documentation](#documentation)
- [Usage](#usage)
  - [CLI](#cli)
    - [Options](#cli-options)
    - [Examples](#cli-examples)
  - [Database](#database)
    - [Create](#create)
    - [Drop](#drop)
    - [Schema Drift](#schema-drift)
    - [Repair Migrations](#repair-migrations)
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
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install typeorm-extension --save
```

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
[dropDatabase](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html#dropDatabase)
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

To get a better overview and understanding of these functions, check out the
[documentation](https://typeorm-extension.tada5hi.net/guide/database-api-reference.html).

### Instances

#### Single

The default DataSource instance can be acquired, by not providing any alias at all or using the key `default`.
If no DataSource instance or DataSourceOptions object is deposited initially the method will attempt to locate and load
the DataSource file and initialize itself from there.

```typescript
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

The factory callback provides an instance of the [faker](https://fakerjs.dev/guide/) library as function argument,
to populate the entity with random data.

**`user.factory.ts`**
```typescript
import { setSeederFactory } from 'typeorm-extension';
import { User } from './user';

export default setSeederFactory(User, (faker) => {
    const user = new User();
    user.firstName = faker.person.firstName('male');
    user.lastName = faker.person.lastName('male');
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });

    return user;
})
```

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
    const query = codec.decode(req.query, { schema: 'user' });
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

A production-shaped version with schema-violation handling (`throwOnFailure`, `ParseError` to `400`) is in the
[Express + TypeORM recipe](https://rapiq.tada5hi.net/guide/recipes/express-typeorm); the client side is covered by the
[frontend recipe](https://rapiq.tada5hi.net/guide/recipes/frontend).

To move over from the removed submodule, follow the migration guide:
[https://rapiq.tada5hi.net/guide/migration-typeorm-extension](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)

> **Note**: This section is kept during the v4 release cycle to route former `applyQuery` users to the
> successor. With the next major release (v5) it will be removed from the README and docs; the
> [rapiq documentation](https://rapiq.tada5hi.net) is the canonical reference.

## Contributing

Before starting to work on a pull request, it is important to review the guidelines for
[contributing](./CONTRIBUTING.md) and the [code of conduct](./CODE_OF_CONDUCT.md).
These guidelines will help to ensure that contributions are made effectively and are accepted.

## License

Made with 💚

Published under [MIT License](./LICENSE).
