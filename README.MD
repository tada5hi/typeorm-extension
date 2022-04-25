[![npm version](https://badge.fury.io/js/typeorm-extension.svg)](https://badge.fury.io/js/typeorm-extension)
[![codecov](https://codecov.io/gh/Tada5hi/typeorm-extension/branch/master/graph/badge.svg?token=4KNSG8L13V)](https://codecov.io/gh/Tada5hi/typeorm-extension)
[![Master Workflow](https://github.com/Tada5hi/typeorm-extension/workflows/main/badge.svg)](https://github.com/Tada5hi/typeorm-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/typeorm-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/typeorm-extension?targetFile=package.json)

# Typeorm Extension 🚀
This is a library to
- `create` or `drop` the (default-) database 🔥
- seed the database ⚡
- validate, parse & apply `fields, filter[s], include[s], page and sort` parameter values ( extended **JSON:API** specification)

---
**Important NOTE**

From `v2.0.0` onwards, this library requires a typeorm version >= v0.3.0 ☂.

---

**Table of Contents**

- [Installation](#installation)
- [Limitations](#limitations)
- [Usage](#usage)
    - [CLI](#cli)
    - [Database](#database)
    - [Seeding](#seeding)
    - [Query](#query)
- [Functions](#functions)
  - Database
     - [createDatabase](#createdatabase)
     - [dropDatabase](#dropdatabase)
  - Seeding
     - [runSeeder](#runseeder)
     - [runSeeders](#runseeders)
  - Query
     - [applyQueryFields](#applyqueryfields)
     - [applyQueryFilters](#applyqueryfilters)
     - [applyQueryPagination](#applyquerypagination)
     - [applyQueryRelations](#applyqueryrelations)
     - [applyQuerySort](#applyquerysort)
- [Types](#types)
  - [Database](#database-types)
    - [DatabaseBaseContext](#databasebasecontext)
    - [DatabaseCreateContext](#databasecreatecontext)
    - [DatabaseDropContext](#databasedropcontext)
  - [Query](#query-types)

## Installation

```bash
npm install typeorm-extension --save
```

## Limitations

At the moment, only the following typeorm drivers are supported
to `create` or `drop` a database:

* CockroachDB
* MSSQL
* MySQL
* Oracle
* Postgres
* SQLite

## Usage

### CLI

The following commands are available in the terminal:
- `typeorm-extension db:create` to create the database
- `typeorm-extension db:drop` to drop the database
- `typeorm-extension seed` seed the database

Alternatively, the full command path can be set in the package.json file to run it e.g. with ts-node.

```
"scripts": {
  ...
  "db:create": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:create",
  "db:drop": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:drop",
  "seed": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js seed"
  ...
}
```

> Read the [Seeding Configuration](#configuration) section to find out how to specify the path,
> for the seeder- & factory-location.

#### Options

| Option                  | Commands                        | Default         | Deprecated | Description                                                                                                                                                                                                                              |
|-------------------------|---------------------------------|-----------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db:create`, `db:drop` & `seed` | `process.cwd()` | `no`       | Path to the data-source / config file.                                                                                                                                                                                                   |
| `--dataSource` or `-d`  | `db:create`, `db:drop` & `seed` | `data-source`   | `no`       | Name of the data-source file.                                                                                                                                                                                                            |
| `--synchronize` or `-s` | `db:create` & `db:drop`         | `yes`           | `no`       | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                         |
| `--initialDatabase`     | `db:create`                     | `undefined`     | `no`       | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always to connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--seed`                | `seed`                          | `undefined`     | `no`       | Specify a specific seed class to run.                                                                                                                                                                                                    |
| `--connection` or `-c`  | `db:create`, `db:drop` & `seed` | `default`       | `yes`      | Name of the connection. Required if there are multiple connections.                                                                                                                                                                      |
| `--config` or `-f`      | `db:create`, `db:drop` & `seed` | `ormconfig.js`  | `yes`      | Name to the config file.                                                                                                                                                                                                                 |

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
        type: 'better-sqlite',
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
import { getConnectionOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

(async () => {
    const options = await getConnectionOptions();

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


To get a better overview and understanding of the [createDatabase](#createdatabase) function go to the [functions](#functions---database) section and read more about it.

#### Drop

**`Example #1`**
```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { dropDatabase } from 'typeorm-extension';

(async () => {
    const options: DataSourceOptions = {
        type: 'better-sqlite',
        database: 'db.sqlite'
    };

    // Create the database with specification of the DataSource options
    await dropDatabase({
        options
    });
})();
```

**`Example #2`**
```typescript
import { getConnectionOptions } from 'typeorm';
import { dropDatabase } from 'typeorm-extension';

(async () => {
    const options = await getConnectionOptions();

    // Create the database with specification of the DataSource options
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

To get a better overview and understanding of the [dropDatabase](#dropdatabase) function go to the [functions](#functions---database) section and read more about it.

### Seeding

Seeding the database is fairly easy and can be achieved by following the steps below:
- `Configuration`: Specify the seed and factory location by path or object.
- `Entity`: Define one or more entities.
- `Factory` (optional): Define a factory for each entity for which data should be automatically generated.
- `Seeder`: Define one or more seeder classes to populate the database with an initial data set or generated data by a factory.
- `Execute`: Run the seeder(s) with the CLI or in the code base.

#### Configuration

The seeder- & factory-location, can be specified via:
- `environment` variable(s)
- extended `data-source.ts` file
- `runSeeder(s)` method options parameter, in case of a direct code base usage

> The default factory path is: `src/database/factories/**/*{.ts,.js}`

> The default seed path is: `src/database/seeds/**/*{.ts,.js}`

`env`
```
TYPEORM_SEEDING_FACTORIES=src/database/factories/**/*{.ts,.js}
TYPEORM_SEEDING_SEEDS=src/database/seeds/**/*{.ts,.js}
```

`data-source.ts`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
    type: 'better-sqlite',
    database: 'db.sqlite',

    seeds: ['src/database/seeds/**/*{.ts,.js}'],
    factories: ['src/database/factories/**/*{.ts,.js}']
};

export const dataSource = new DataSource(options);
```

`runSeeder(s)`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';

(async () => {
    const options: DataSourceOptions = {
        type: 'better-sqlite',
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

**`user.factory.ts`**
```typescript
import { setSeederFactory } from 'typeorm-extension';
import { User } from './user';

export default setSeederFactory(User, (faker) => {
    const user = new User();
    user.firstName = faker.name.firstName('male');
    user.lastName = faker.name.lastName('male');
    user.email = faker.internet.email(user.firstName, user.lastName);

    return user;
})
```

#### Seeder
And last but not least, create a seeder. The seeder can be called by the cli command `seed` or in the codebase
by using the function `runSeeder`.
A seeder class only requires one method, called `run` and provides the arguments `dataSource` & `factoryManager`.

**`user.seeder.ts`**

The final seeder class could look like this:

```typescript
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from './user';

export default class UserSeeder implements Seeder {
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

#### Execute

Populate the database from the code base:

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { runSeeders, SeederOptions } from 'typeorm-extension';
import { User } from 'user';

(async () => {
    const options: DataSourceOptions & SeederOptions = {
        type: 'better-sqlite',
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
import { runSeeder, SeederOptions } from 'typeorm-extension';
import { User } from 'user';
import UserSeeder from 'user.seeder';
import UserFactory from 'user.factory';

(async () => {
    const options: DataSourceOptions & SeederOptions = {
        type: 'better-sqlite',
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
The query submodule enables query parameter (fields, filter, ...) values to be build, parsed & validated.
Therefore, the [@trapi/query](https://www.npmjs.com/package/@trapi/query) library is used under the hood.
The main functions and types are also exposed by this library.

For explanation proposes,
two simple entities with a relation between them are declared to demonstrate the usage of the query utils:

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
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

In the following example [express](https://www.npmjs.com/package/express) is used to handle the HTTP request.
Each query parameter is applied individually in following code snippet (applyQueryFields, applyQueryFilter, ...).

```typescript
import { getRepository } from 'typeorm';
import { Request, Response } from 'express';
import {
    applyQueryFields,
    applyQueryFilters,
    applyQueryRelations,
    applyQueryPagination,
    applyQuerySort
} from 'typeorm-extension';

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include=profile&filter[id]=1&fields[user]=id,name
 *
 * Return Example:
 * {
 *     data: [
 *         {id: 1, name: 'tada5hi', profile: {avatar: 'avatar.jpg', cover: 'cover.jpg'}}
 *      ],
 *     meta: {
 *        total: 1,
 *        limit: 20,
 *        offset: 0
 *    }
 * }
 * @param req
 * @param res
 */
export async function getUsers(req: Request, res: Response) {
    const {fields, filter, include, page, sort} = req.query;

    const repository = getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    const relationsParsed = applyQueryRelations(query, include, {
        defaultAlias: 'user',
        allowed: ['profile']
    });

    applyQuerySort(query, sort, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id'],
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        relations: relationsParsed
    });

    applyQueryFields(query, fields, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        // porfile fields can only be included, if the relation 'profile' is included.
        relations: relationsParsed
    })

    // only allow filtering users by id & name
    applyQueryFilters(query, filter, {
        defaultAlias: 'user',
        allowed: ['id', 'name', 'profile.id'],
        // porfile.id can only be used as a filter, if the relation 'profile' is included.
        relations: relationsParsed
    });

    // only allow to select 20 items at maximum.
    const pagination = applyQueryPagination(query, page, {maxLimit: 20});

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return res.json({
        data: {
            data: entities,
            meta: {
                total,
                ...pagination
            }
        }
    });
}
```

## Functions - Database

### createDatabase

▸ `function` **createDatabase**(`context?: DatabaseCreateContext`): `Promise`<`unknown`>

Create database.

#### Example

**`Simple`**
```typescript
// Only create database if it does not exist.
await createDatabase({ ifNotExist: true });
```

**`Synchronization`**
```typescript
// To not synchronize database schema after database creation.
await createDatabase({ synchronize: false });
```

**`Charset`**

It is possible to explizit specify `charset` & `characterSet`, besides defining it as part of the `DataSourceOptions` object.
E.g.
- postgres
  ```typescript
   await createDatabase({ characterSet: "UTF8" });
  ```
- mysql
  ```typescript
  await createDatabase({ charset: "utf8mb4_general_ci", characterSet: "utf8mb4" });
  ```

**`DataSourceOptions`**

- The typeorm DataSourceOptions object can be provided as `options` property to the createDatabase method.

  ```typescript
  import { DataSourceOptions } from 'typeorm';
  import { createDatabase } from 'typeorm-extension';

  (async () => {
     const options : DataSourceOptions = {
        //...
     };
     // Create database
     await createDatabase({
        options
     });
  })();
  ```

- if `entities` & `subscribers` are defined as path, it is possible to use them with e.g. ts-node as well as with the compiled version.
  Therefore, extend the DataSourceOptions with the `extendDataSourceOptions` utility method.

  ```typescript
  import { DataSourceOptions } from 'typeorm';
  import { createDatabase, extendDataSourceOptions } from 'typeorm-extension';

  (async () => {
     let options : DataSourceOptions = {
         // ...
     }

     options = await extendDataSourceOptions(options);

     // Create database
     await createDatabase({
        options
     });
  })();
  ```
  This is achieved by rewriting the `src` path and `.ts` extension, to the `dist` (outDir) path and `.js` extension.

  If the function is **not** called within the ts-node runtime environment, the source path `src/database/entities.ts` for example,
  will be rewritten to `dist/database/entities.js`.

#### Parameters

| Name      | Type                    | Description                                                                         |
|:----------|:------------------------|:------------------------------------------------------------------------------------|
| `context` | `DatabaseCreateContext` | Specify charset, coalition and DataSourceOptions. [Details](#databasecreatecontext) |

#### Returns

`Promise`<`unknown`>

The function returns a promise with the query result of the underlying database driver.

### dropDatabase

▸ `function` **dropDatabase**(`context?: DatabaseDropContext`): `Promise`<`unknown`>

Drop database.

#### Example
**`Simple`**
```typescript
import { createDatabase } from 'typeorm-extension';

(async () => {
    await dropDatabase();
})();
```

**`DataSourceOptions`**

The typeorm DataSourceOptions object can be provided as `options` property to the dropDatabase method.

```typescript
import { DataSourceOptions } from 'typeorm';
import { dropDatabase } from 'typeorm-extension';

(async () => {
    const options : DataSourceOptions = {
        //...
    };
    // Drop database
    await dropDatabase({
        options
    });
})();
```

#### Parameters

| Name      | Type                  | Description                                                                       |
|:----------|:----------------------|:----------------------------------------------------------------------------------|
| `context` | `DatabaseDropContext` | Specify charset, coalition and DataSourceOptions. [Details](#databasedropcontext) |

#### Returns

`Promise`<`unknown`>

The function returns a promise with the query result of the underlying database driver.

## Functions - Seeding

### runSeeder

▸ `function` **runSeeder**(`dataSource?: DataSource`, `seeder: SeederConstructor`, `options: SeederOptions`): `Promise`<`void`>

Populate the database with a specific seeder.

#### Example

**`Simple`**

```typescript
import { DataSource } from 'typeorm';
import { runSeeder, Seeder, SeederFactoryManager } from 'typeorm-extension';

class SimpleSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<void> {
        // ...
    }
}

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource, SimpleSeeder);
})();

```

**`SeederOptions`**

```typescript
import { DataSource } from 'typeorm';
import { runSeeder, Seeder, SeederFactoryManager } from 'typeorm-extension';

class SimpleSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<void> {
        // ...
    }
}

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource, SimpleSeeder, {
        factories: ['src/database/factories/*{.ts,.js}']
    });
})();
```

#### Parameters

| Name         | Type                 | Description                                               |
|:-------------|:---------------------|:----------------------------------------------------------|
| `dataSource` | `DataSource`         | Typeorm DataSource Object                                 |
| `seeder`     | `SeederConstructor`  | A class which implements the Seeder Interface.            |
| `options`    | `SeederOptions`      | Seeding options to provide or overwrite the default ones. |

#### Returns

`Promise`<`void`>

### runSeeders

▸ `function` **runSeeders**(`dataSource?: DataSource`, `options: SeederOptions`): `Promise`<`void`>

Populate the database.

#### Example

**`Simple`**

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource);
})();

```

**`SeederOptions`**

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource, {
        seeds: ['src/database/seeds/*{.ts,.js}'],
        factories: ['src/database/factories/*{.ts,.js}']
    });
})();
```

#### Parameters

| Name         | Type               | Description                                               |
|:-------------|:-------------------|:----------------------------------------------------------|
| `dataSource` | `DataSource`       | Typeorm DataSource Object                                 |
| `options`    | `SeederOptions`    | Seeding options to provide or overwrite the default ones. |

#### Returns

`Promise`<`void`>

## Functions - Query

### applyQueryFields

▸ `function` **applyQueryFields**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: FieldsApplyOptions`): `FieldsApplyOutput`

Parse and apply fields of the main entity and optional of included relations passed in as `Record<string, string[]>` or `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryFields} from "typeorm-extension";

const fields = applyQueryFields(query, ['name'], {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(fields);
// [{alias: 'user', fields: ['name']}]
```

#### Type parameters

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


#### Parameters

| Name      | Type                      | Description                                                 |
|:----------|:--------------------------|:------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                           |
| `data`    | `unknown`                 | Fields in raw format. F.e `['name']` or `{user: ['name']}`. |
| `options` | `FieldsApplyOptions`      | Options for the fields to select.                           |

#### Returns

`FieldsApplyOutput`

The function returns an array of objects. Each object has the properties `fields` and optional `alias` and `addFields`.

### applyQueryFilters

▸ `function` **applyQueryFilters**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: FiltersApplyOptions`): `FiltersApplyOutput`

Transform filters of the main entity and optional of included relations passed in as `Record<string, unknown>` and apply them to the `SelectQueryBuilder`, in case they match the allowed filters.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryFilters} from "typeorm-extension";

const filters = applyQueryFilters(query, {id: 1}, {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(filters);
// [{alias: 'user', key: 'id', value: 1}]
```

#### Type parameters

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


#### Parameters

| Name      | Type                      | Description                          |
|:----------|:--------------------------|:-------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.    |
| `data`    | `unknown`                 | Fields in raw format. F.e `{id: 1}`. |
| `options` | `FiltersApplyOptions`     | Options for the fields to select.    |

#### Returns

`FiltersApplyOutput`

The function returns an array of objects. Each object has the properties `key` and `value`.


### applyQueryRelations

▸ `function` **applyQueryRelations**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: RelationsApplyOptions`): `RelationsApplyOutput`

Transform relations passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed relations.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryRelations} from "typeorm-extension";

const includes = applyQueryRelations(query, ['roles'], {
    allowed: ['roles', 'photos'],
    defaultAlias: 'user'
});

console.log(includes);
// [{property: 'user.roles', alias: 'roles'}]
```

#### Type parameters

| Name  | Description         |
|:------|:--------------------|
| `T`   | Typeorm entity type |


#### Parameters

| Name      | Type                      | Description                                         |
|:----------|:--------------------------|:----------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                   |
| `data`    | `unknown`                 | Relations in raw format. F.e `['roles']` or `roles` |
| `options` | `RelationsApplyOptions`   | Options for the relations to include.               |

#### Returns

`RelationsApplyOutput`

The function returns an array of objects. Each object has the properties `property` and `alias`.

### applyQueryPagination

▸ `function` **applyQueryPagination**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: PaginationApplyOptions`): `PaginationApplyOutput`

Transform pagination data passed in as `{limit?: number, offset?: number}` and apply it to the `SelectQueryBuilder`.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryPagination} from "typeorm-extension";

const pagination = applyQueryPagination(query, {limit: 100}, {
    maxLimit: 50
});

console.log(pagination);
// {limit: 50}
```

#### Type parameters

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


#### Parameters

| Name      | Type                      | Description                                                   |
|:----------|:--------------------------|:--------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                             |
| `data`    | `unknown`                 | Pagination data in raw format. F.e `{limit: 20, offset: 10}`. |
| `options` | `PaginationApplyOptions`  | Options for the pagination to select.                         |

#### Returns

`PaginationApplyOutput`

The function returns an object. The object might have the properties `limit` and `offset`.

### applyQuerySort

▸ `function` **applyQuerySort**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: SortApplyOptions`): `SortApplyOutput`

Transform sort fields passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields to sort.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQuerySort} from "typeorm-extension";

const sort = applyQuerySort(query, ['-name'], {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(sort);
// {'user.name': 'DESC'}
```

#### Type parameters

| Name   | Description         |
|:-------|:--------------------|
| `T`    | Typeorm entity type |


#### Parameters

| Name      | Type                      | Description                                                                                                               |
|:----------|:--------------------------|:--------------------------------------------------------------------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                                                                                         |
| `data`    | `unknown`                 | Sorting Fields in raw format. F.e `['-name']`, `-name` or `{name: 'DESC'}`. The hyphen prefix indicates descending order. |
| `options` | `SortApplyOptions`        | Options for the sorting strategy.                                                                                         |

#### Returns

`SortApplyOutput`

The function returns an objects. Each key-value pair represents a field and the corresponding sorting direction.

## Types

### Database Types

#### DatabaseBaseContext
```typescript
import { DataSourceOptions } from 'typeorm';
import { DataSourceFindOptions } from 'typeorm-extension';

export type DatabaseBaseContext = {
    /**
     * Options for finding the typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,

    /**
     * Options for the find method, where to look for the data-source file.
     */
    findOptions?: DataSourceFindOptions
};
```

#### DatabaseCreateContext
```typescript
import { DatabaseBaseContext } from 'typeorm-extension';

export type DatabaseCreateContext = DatabaseBaseContext & {
    /**
     * Only create database if not already exist.
     *
     * default: true
     */
    ifNotExist?: boolean,
    /**
     * Initial database to connect.
     *
     * default: undefined
     */
    initialDatabase?: string,
    /**
     * Synchronize database entities.
     *
     * default: true
     */
    synchronize?: boolean
};
```

#### DatabaseDropContext

```typescript
import { DatabaseBaseContext } from 'typeorm-extension';

export type DatabaseDropContext = DatabaseBaseContext & {
    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};
```

### Query Types

To understand the structure of the parsed query parameter values or to know which values can be passed as (i.e. `buildQuery`, `parseQuery`, ...) function argument,
check out the [Types](https://www.npmjs.com/package/@trapi/query#types) and [Functions](https://www.npmjs.com/package/@trapi/query#functions) section
of the README.md file of the [@trapi/query](https://www.npmjs.com/package/@trapi/query) library.
