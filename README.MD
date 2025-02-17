# Typeorm Extension 🚀

[![npm version](https://badge.fury.io/js/typeorm-extension.svg)](https://badge.fury.io/js/typeorm-extension)
[![codecov](https://codecov.io/gh/Tada5hi/typeorm-extension/branch/master/graph/badge.svg?token=4KNSG8L13V)](https://codecov.io/gh/Tada5hi/typeorm-extension)
[![Master Workflow](https://github.com/Tada5hi/typeorm-extension/workflows/CI/badge.svg)](https://github.com/Tada5hi/typeorm-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/typeorm-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/typeorm-extension?targetFile=package.json)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

This is a library to
- `create`, `drop` & `seed` the (default-) database 🔥
- manage one or many data-source instances 👻
- parse & apply query parameters (extended **JSON:API** specification & fully typed) to:
    - `filter` (related) resources according to one or more criteria,
    - reduce (related) resource `fields`,
    - `include` related resources,
    - `sort` resources according to one or more criteria,
    - limit the number of resources returned in a response by `page` limit & offset

> **Warning**
> This readme includes the documentation for the upcoming version 3.
> This is the [link](https://github.com/tada5hi/typeorm-extension/tree/v2) for the v2.

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

If you use esm, the executable must be changed from `typeorm-extension` to `typeorm-extension-esm`.
The following commands are available in the terminal:
- `typeorm-extension db:create` to create the database
- `typeorm-extension db:drop` to drop the database
- `typeorm-extension seed:run` seed the database
- `typeorm-extension seed:create` to create a new seeder

If the application has not yet been built or is to be tested with ts-node, the commands can be adapted as follows:

```
"scripts": {
    "db:create": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:create",
    "db:drop": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:drop",
    "seed:run": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs seed:run",
    "seed:create": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs seed:create"
}
```
To test the application in the context of an esm project, the following adjustments must be made:
- executable `ts-node` to `ts-node-esm`
- library path `cli.cjs` to `cli.mjs`

Read the [Seeding Configuration](#configuration) section to find out how to specify the path,
for the seeder- & factory-location.

#### CLI Options

| Option                  | Commands                                           | Default         | Description                                                                                                                                                                                                                             |
|-------------------------|----------------------------------------------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db:create`, `db:drop`, `seed:create` & `seed:run` | `process.cwd()` | Root directory of the project.                                                                                                                                                                                                          |
| `--dataSource` or `-d`  | `db:create`, `db:drop` & `seed:run`                | `data-source`   | Name (or relative path incl. name) of the data-source file.                                                                                                                                                                             |
| `--synchronize` or `-s` | `db:create`                            | `yes`           | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                        |
| `--initialDatabase`     | `db:create`                                        | `undefined`     | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--name`                | `seed:create` & `seed:run`                         | `undefined`     | Name (or relative path incl. name) of the seeder.                                                                                                                                                                                       |
| `--preserveFilePaths`   | `db:create`, `db:drop`, `seed:create` & `seed:run` | `false`         | This option indicates if file paths should be preserved and treated as if the just-in-time compilation environment is detected.                                                                                                         |

#### CLI Examples
**`Database Create`**
```shell
ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:create  -d src/data-source.ts
```
**`Database Drop`**
```shell
ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:drop  -d src/data-source.ts
```

**`Seed Run`**
```shell
ts-node ./node_modules/typeorm-extension/bin/cli.cjs seed:run  -d src/data-source.ts
```

**`Seed Run Explicit`**
```shell
ts-node ./node_modules/typeorm-extension/bin/cli.cjs seed:run  -d src/data-source.ts --name src/database/seeds/user.ts
```

**`Seed Create`**
```shell
ts-node ./node_modules/typeorm-extension/bin/cli.cjs seed:create  --name src/database/seeds/user.ts
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
        type: 'better-sqlite',
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
- use `*` to match anything expect slashes and hidden files
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

It is possible to define that a seeder is only executed once.
This can either be set globally using the seedTacking option or locally using the track property of a seeder class.

`data-source.ts`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
    type: 'better-sqlite',
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

The factory callback provides an instance of the [faker](https://fakerjs.dev/guide/) library as function argument,
to populate the entity with random data.

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

#### Seed
And last but not least, create a seeder. The seeder can be called by the cli command `seed` or in the codebase
by using the function `runSeeder`.
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
import { runSeeders, SeederOptions } from 'typeorm-extension';
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
Therefore, the [rapiq](https://www.npmjs.com/package/rapiq) library is used under the hood.

The query parameter options (allowed, default, ...) are fully typed 🔥 and depend on the (nested-) properties of the target entity passed to
the typeorm query builder.

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

In this example [routup](https://www.npmjs.com/package/routup) and the
plugin [@routup/query](https://www.npmjs.com/package/@routup/query) is used to handle HTTP requests,
but there is also a guide available for [express](https://typeorm-extension.tada5hi.net/guide/query.html).

```typescript
import { createServer } from 'node:http';
import type { Request, Response } from 'routup';
import { createNodeDispatcher, Router } from 'routup';
import { createHandler, useQuery } from '@routup/query';

import {
    applyQuery,
    useDataSource
} from 'typeorm-extension';

const router = new Router();
router.use(createHandler());

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
router.get('users', async (req: Request, res: Response) => {
    const dataSource = await useDataSource();
    const repository = dataSource.getRepository(User);
    const query = repository.createQueryBuilder('user');

    // -----------------------------------------------------

    const { pagination } = applyQuery(query, useQuery(req), {
        defaultAlias: 'user',
        fields: {
            // porfile fields can only be included,
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id', 'profile.avatar'],
        },
        filters: {
            // porfile.id can only be used as a filter,
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id'],
        },
        pagination: {
            // only allow to select 20 items at maximum.
            maxLimit: 20
        },
        relations: {
            allowed: ['profile']
        },
        sort: {
            // profile.id can only be used as sorting key,
            // if the relation 'profile' is included.
            allowed: ['id', 'name', 'profile.id']
        },
    });

    // -----------------------------------------------------

    const [entities, total] = await query.getManyAndCount();

    return {
        data: entities,
        meta: {
            total,
            ...pagination
        }
    };
});

const server = createServer(createNodeDispatcher(router));
server.listen(80);
```

## Contributing

Before starting to work on a pull request, it is important to review the guidelines for
[contributing](./CONTRIBUTING.md) and the [code of conduct](./CODE_OF_CONDUCT.md).
These guidelines will help to ensure that contributions are made effectively and are accepted.

## License

Made with 💚

Published under [MIT License](./LICENSE).
