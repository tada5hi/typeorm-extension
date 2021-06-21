[![npm version](https://badge.fury.io/js/typeorm-extension.svg)](https://badge.fury.io/js/typeorm-extension)

# Typeorm Extension 🚀
This is a library to
- `create` or `drop` the database specified for the typeorm connection.
- extend the typeorm query for a given `QueryBuilder` with `filters, includes, pagination and fields` (json-api spec).
- execute a full database setup (f.e create Database, setup Schema, run Seeds) with the `Command-Line-Interface (CLI)`.


**Table of Contents**

- [Installation](#installation)
- [Limitations](#limitations)
- [Usage](#usage)


## Installation

```bash
npm install typeorm-extension --save
```

### Limitations

At the moment you can only `create` and `drop` for the
following typeorm drivers:
* MSSQL
* MySQL
* Oracle
* Postgres
* SQLite

## Usage
### Create/Drop Database

To `create` or `drop` the default database of the typeorm connection,
you can simply create the `ConnectionOptions` for the Connection,
like described in the following example:

```typescript
import {ConnectionOptions, getConnectionOptions} from 'typeorm';
import {createDatabase, dropDatabase} from "typeorm-extension";

(async () => {
    const connectionOptions: ConnectionOptions = await getConnectionOptions();

    // Create database
    await createDatabase(connectionOptions);

    // Drop Database
    await dropDatabase(connectionOptions);
})();
```
You can also `create` the database if it doesn't exist or only `drop` it if it exists.

```typescript
await createDatabase(connectionOptions, {ifNotExist: true});
await dropDatabase(connectionOptions, {ifExist: true});
```

If you have defined `entites` or `subscribers` by environment variables or with another typeorm configuration option,
you may want to use them with ts-node as well with the build (`dist`) variant.
Therefore, you can build the ConnectionOptions with the build in function `buildConnectionOptions`.

```typescript
import {ConnectionOptions} from 'typeorm';
import {craeteDatabase, dropDatabase, buildConnectionOptions} from "typeorm-extension";

(async () => {
    const connectionOptions: ConnectionOptions = await buildConnectionOptions();

    // Create database
    await createDatabase(connectionOptions);

    // Drop Database
    await dropDatabase(connectionOptions);
})();
```
If you have specified the path pattern for the entities like:
`src/database/entities.ts`, the function will rewrite it to `dist/database/entities.js`,
if the function is not called within the ts-node runtime environment.

The same logic applies to the `seeds` and `factories` path(s) of the `typeorm-seeding` library.

### Request Utils
For explanation proposes of the request utils,
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

When you use express or another library, you can use the request utils accordingly to the
following code snippet:

```typescript
import {getRepository} from "typeorm";
import {Request, Response} from 'express';
import {
    applyRequestFilter,
    applyRequestIncludes,
    applyRequestPagination,
    applyRequestFields
} from "typeorm-extension";

/**
 * Get many users.
 *
 * Request example
 * - url: /users?page[limit]=10&page[offset]=0&include[user]=profile&filter[id]=1&fields[user]=id,name
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
    const {include, page, fields, filter} = req.query;

    const repository = getRepository(User);
    const query = repository.createQueryBuilder('user');

    // only allow filtering users by id & name
    applyRequestFilter(query, filter, ['id','name']);

    // only allow returning 20 items at max
    const pagination = applyRequestPagination(query, page, 20);

    // only allow tow include profile relation, by key profile (property key),
    // relative to query entity alias 'user'
    applyRequestIncludes(query, 'user', include, {
        profile: 'profile'
    });

    // Only allow to select fields id, name for query alias 'user'
    applyRequestFields(query, fields,
        {user: ['id', 'name']},
        {aliasMapping: {user: 'user'}
    });

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

### Command Line Interface

todo

