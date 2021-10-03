[![npm version](https://badge.fury.io/js/typeorm-extension.svg)](https://badge.fury.io/js/typeorm-extension)
[![codecov](https://codecov.io/gh/Tada5hi/typeorm-extension/branch/master/graph/badge.svg?token=4KNSG8L13V)](https://codecov.io/gh/Tada5hi/typeorm-extension)
[![Master Workflow](https://github.com/Tada5hi/typeorm-extension/workflows/main/badge.svg)](https://github.com/Tada5hi/typeorm-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/typeorm-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/typeorm-extension?targetFile=package.json)
# Typeorm Extension 🚀
This is a library to
- `create` or `drop` the (default-) database 🔥 for a defined typeorm connection.
- execute a full database setup (f.e create Database, setup Schema, run Seeds) with the `Command-Line-Interface (CLI)` ⚡.
- validate, parse & apply `fields, filter[s], include[s], page and sort` parameter values to the `QueryBuilder` ( extended **JSON:API** specification).

**Table of Contents**

- [Installation](#installation)
- [Limitations](#limitations)
- [Usage](#usage)
    - [CLI](#cli)
    - [Runtime](#runtime)
        - [Database](#database)
        - [Query](#query)
- [Functions](#functions)
    - Database
        - [createDatabase](#createdatabase)
        - [dropDatabase](#dropdatabase)
    - Query
        - [applyParsedQuery]()
        - [applyQuery]()
        - [applyQueryFields](#applyqueryfields)
        - [applyQueryFilters](#applyqueryfilters)
        - [applyQueryRelations](#applyqueryrelations)
        - [applyQueryPagination](#applyquerypagination)
        - [applyQuerySort](#applyquerysort)
- [Types](#types)
  - Database
    - [CustomOptions](#customoptions)
  - [Query](#query-types)

## Installation

```bash
npm install typeorm-extension --save
```

## Limitations

At the moment you can only `create` and `drop` a database for one of the following typeorm drivers:
* CockroachDB
* MSSQL
* MySQL
* Oracle
* Postgres
* SQLite

## Usage

### CLI

You can use the following commands in the terminal:
- `typeorm-extension db:create` to create the database
- `typeorm-extension db:drop` to drop the database

Alternatively, you can set the full command path in the package.json file and run it f.e. with ts-node.

```
"scripts": {
  ...
  "db:create": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:create",
  "db:drop": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:drop",
  ...
}
```

#### CLI Options

| Option                 | Default         | Description                                                                 |
| ---------------------- | --------------- | --------------------------------------------------------------------------- |
| `--connection` or `-c` | `default`       | Name of the typeorm connection. Required if there are multiple connections. |
| `--config` or `-f`     | `ormconfig.js`  | Name to the typeorm config file.                                            |
| `--root` or `-r`       | `process.cwd()` | Path to the typeorm config file.                                            |
| `--synchronize` or `-s`| `yes`           | Synchronize the database schema after database creation. This option is only available for the create command. Options: `yes` or `no`. |
| `--initialDatabase`    | `undefined`     | Specify the initial database to connect to. This option is only available for the create command and is only relevant for the `postgres` driver, where you always have to connect to a database. If you don't provide a database, the database name will be equal to the connection user name.|

### Runtime

#### Database
As an alternative to the CLI variant, you can `create` or `drop` the specified/default database through your own code base.
Therefore, you can create the `ConnectionOptions` for the Connection manually, or let it be created automatically:

**General**
```typescript
import {ConnectionOptions, getConnectionOptions} from 'typeorm';
import {createDatabase, dropDatabase} from "typeorm-extension";

(async () => {
    const connectionOptions: ConnectionOptions = await getConnectionOptions();

    // Create database with connection specification
    await createDatabase(undefined, connectionOptions);

    // or without manually specification
    await createDatabase({ifNotExist: true});


    // Drop Database with connection specification
    await dropDatabase(undefined, connectionOptions);

    // or without manually specification
    await dropDatabase({ifExist: true});
})();
```

To get a better overview and understanding about the [createDatabase](#createdatabase) and the [dropDatabase](#dropdatabase) function go to the [functions](#functions) section and read more about it.

#### Query
To build & parse (+validate) query parameter (fields, filter, ...) values, this library uses [@trapi/query](https://www.npmjs.com/package/@trapi/query) under the hood.
The main functions and types are also exposed by this library.

To understand the full syntax to build an acceptable URL query string, which can be parsed check out the `README.md` of the [@trapi/query](https://www.npmjs.com/package/@trapi/query) library.

---

For explanation proposes of the query utils,
two simple entities with a simple relation between them are declared to demonstrate their usage:

```typescript
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn
} from "typeorm";

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

In the following example [typeorm](https://www.npmjs.com/package/typeorm) is used for object-relational mapping (ORM)
and [express](https://www.npmjs.com/package/express) to handle requests.

When you use express or another library, you can use the API utils accordingly to the
following code snippet:

```typescript
import {getRepository} from "typeorm";
import {Request, Response} from 'express';
import {
    applyQueryFields,
    applyQueryFilters,
    applyQueryRelations,
    applyQueryPagination,
    applyQuerySort
} from "typeorm-extension";

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
        queryAlias: 'user',
        allowed: ['profile']
    });

    applyQuerySort(query, sort, {
        queryAlias: 'user',
        allowed: ['id', 'name', 'profile.id'],
        // profile.id can only be used as sorting key, if the relation 'profile' is included.
        relations: relationsParsed
    });

    applyQueryFields(query, fields, {
        queryAlias: 'user',
        allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        // porfile fields can only be included, if the relation 'profile' is included.
        relations: relationsParsed
    })

    // only allow filtering users by id & name
    applyQueryFilters(query, filter, {
        queryAlias: 'user',
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

## Functions

### createDatabase

▸ `function` **createDatabase**(`options?: CustomOptions`, `connectionOptions?: ConnectionOptions`): `Promise`<`unknown`>

Create database.

#### Example

**`Status`**
```typescript
// Only create database if it does not exists.
await createDatabase({ifNotExist: true});
```

**`Charset`**

You can also specify the `charset` and `characterSet` as property of the `CustomOptions` parameter
or parse it as extra parameter (ENV: TYPEORM_DRIVER_EXTRA) of the ormconfig.
F.e
- postgres
  ```typescript
   await createDatabase({ifNotExist: true, characterSet: "UTF8"});
  ```
- mysql
  ```typescript
  await createDatabase({ifNotExist: true, charset: "utf8mb4_general_ci", characterSet: "utf8mb4"});
  ```

**`ConnectionOptions`**

If you have defined `entites` or `subscribers` by environment variables or with another typeorm configuration option,
you may want to use them with ts-node as well with the build (`dist`) variant.
Therefore, you can build the ConnectionOptions with the build in function `buildConnectionOptions`.

```typescript
import {craeteDatabase, dropDatabase, buildConnectionOptions} from "typeorm-extension";

(async () => {
    const connectionOptions = await buildConnectionOptions();
    // Create database
    await createDatabase({ifNotExist: true}, connectionOptions);
})();
```
If you have specified the path pattern for the entities like:
`src/database/entities.ts`, the function will rewrite it to `dist/database/entities.js`,
in case the function is not called within the ts-node runtime environment.

The same logic applies to `seeds` and `factories` path(s) of the `typeorm-seeding` library.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | `CustomOptions` | Specify custom options like charset, coalition & conditions. |
| `connectionOptions` | `ConnectionOptions` | Pass typeorm connection options object. |

#### Returns

`Promise`<`unknown`>

The function returns a promise with query results provided by underlying db driver.

### dropDatabase

▸ `function` **dropDatabase**(`options?: CustomOptions`, `connectionOptions?: ConnectionOptions`): `Promise`<`unknown`>

Drop database.

#### Example
**`Simple`**
```typescript
// Only drop database if it does exists.
await dropDatabase({ifExist: true});
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | `CustomOptions` | Specify custom options like charset, coalition & conditions. |
| `connectionOptions` | `ConnectionOptions` | Pass typeorm connection options object. |

#### Returns

`Promise`<`unknown`>

The function returns a promise with query results provided by underlying db driver.

## Functions - Query

### applyQueryFields

▸ `function` **applyQueryFields**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: FieldsOptions`): `FieldsTransformed`

Transform fields of the main entity and optional of included relations passed in as `Record<string, string[]>` or `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryFields} from "typeorm-extension";

const fields = applyQueryFields(query, ['name'], {
    allowed: ['id', 'name'],
    queryAlias: 'user'
});

console.log(fields);
// [{alias: 'user', fields: ['name']}]
```

#### Type parameters

| Name | Description |
| :------ | :------ |
| `T` | Typeorm entity type


#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class. |
| `data` | `unknown` | Fields in raw format. F.e `['name']` or `{user: ['name']}`. |
| `options` | `FieldsOptions` | Options for the fields to select.

#### Returns

`FieldsTransformed`

The function returns an array of objects. Each object has the properties `fields` and optional `alias` and `addFields`.

### applyQueryFilters

▸ `function` **applyQueryFilters**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: FiltersOptions`): `FiltersTransformed`

Transform filters of the main entity and optional of included relations passed in as `Record<string, unknown>` and apply them to the `SelectQueryBuilder`, in case they match the allowed filters.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryFilters} from "typeorm-extension";

const filters = applyQueryFilters(query, {id: 1}, {
    allowed: ['id', 'name'],
    queryAlias: 'user'
});

console.log(filters);
// [{statement: 'user.id = :filter_id', binding: {'filter_id': 1}}]
```

#### Type parameters

| Name | Description |
| :------ | :------ |
| `T` | Typeorm entity type


#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class. |
| `data` | `unknown` | Fields in raw format. F.e `{id: 1}`. |
| `options` | `FiltersOptions` | Options for the fields to select.

#### Returns

`FiltersTransformed`

The function returns an array of objects. Each object has the properties `statement` and `binding`.


### applyQueryRelations

▸ `function` **applyQueryRelations**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: IncludesOptions`): `IncludesTransformed`

Transform relations passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed relations.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQueryRelations} from "typeorm-extension";

const includes = applyQueryRelations(query, ['roles'], {
    allowed: ['roles', 'photos'],
    queryAlias: 'user'
});

console.log(includes);
// [{property: 'user.roles', alias: 'roles'}]
```

#### Type parameters

| Name | Description |
| :------ | :------ |
| `T` | Typeorm entity type


#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class. |
| `data` | `unknown` | Relations in raw format. F.e `['roles']` or `roles` |
| `options` | `IncludesOptions` | Options for the relations to include.

#### Returns

`IncludesTransformed`

The function returns an array of objects. Each object has the properties `property` and `alias`.

### applyQueryPagination

▸ `function` **applyQueryPagination**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: PaginationOptions`): `PaginationTransformed`

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

| Name | Description |
| :------ | :------ |
| `T` | Typeorm entity type


#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class. |
| `data` | `unknown` | Pagination data in raw format. F.e `{limit: 20, offset: 10}`. |
| `options` | `PaginationOptions` | Options for the pagination to select.

#### Returns

`PaginationTransformed`

The function returns an object. The object might have the properties `limit` and `offset`.

### applyQuerySort

▸ `function` **applyQuerySort**<`T`>(`query: SelectQueryBuilder<T>`, `data: unknown`, `options?: SortOptions`): `SortTransformed`

Transform sort fields passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields to sort.

#### Example
**`Simple`**

```typescript
// Only drop database if it does exists.
import {applyQuerySort} from "typeorm-extension";

const sort = applyQuerySort(query, ['-name'], {
    allowed: ['id', 'name'],
    queryAlias: 'user'
});

console.log(sort);
// {'user.name': 'DESC'}
```

#### Type parameters

| Name | Description |
| :------ | :------ |
| `T` | Typeorm entity type


#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `query` | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class. |
| `data` | `unknown` | Sorting Fields in raw format. F.e `['-name']`, `-name` or `{name: 'DESC'}`. The hyphen prefix indicates descending order.  |
| `options` | `SortOptions` | Options for the sorting strategy.

#### Returns

`SortTransformed`

The function returns an objects. Each key-value pair represents a field and the corresponding sorting direction.

## Types

### CustomOptions
```typescript
type CustomOptions = {
    characterSet?: string,
    charset?: string,
    ifExist?: boolean,
    ifNotExist?: boolean,
    initialDatabase?: string
};
```

### Query Types

To understand the structure of the parsed query parameter values or to know which values can be passed as (i.e. `buildQuery`, `parseQuery`, ...) function argument,
check out the [Types](https://www.npmjs.com/package/@trapi/query#types) and [Functions](https://www.npmjs.com/package/@trapi/query#functions) section
of the README.md file of the [@trapi/query](https://www.npmjs.com/package/@trapi/query) library.
