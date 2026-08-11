# Seeding

Seeding the database is fairly easy and can be achieved by following the steps below:
- `Configuration`: Specify the seed and factory location by path or object.
- `Entity`: Define one or more entities.
- `Factory` (optional): Define a factory for each entity for which data should be automatically generated.
- `Seed`: Define one or more seed classes to populate the database with an initial data set or generated data by a factory.
- `Execute`: Run the seeder(s) with the CLI or in the code base.

## Configuration

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

Seeder options can be provided per invocation (`runSeeder(s)` options parameter), on the extended
data-source options, or via environment variables. Explicit input wins over the data-source options,
which win over the environment; built-in defaults apply last.

It is possible to define that a seeder is only executed once.
This can either be set globally using the `seedTracking` option or locally using the `track`
property of a seeder class. Executed seeds are recorded in a `seeds` table (a collection for
MongoDB); the table name can be changed with the `seedTableName` option.

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

## Entity
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

## Factory
To create entities with random data, create a factory for each desired entity.
The definition of a factory is **optional**.

The factory callback returns the entity to persist. Pick any data generator you like and import it in the
factory file. The examples use [faker](https://fakerjs.dev/guide/), which is not a dependency of this
package: install it yourself with `npm install @faker-js/faker --save-dev`.

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

Because the factory file owns the generator instance, locale selection and reproducible runs are done
with the generator's own API:

```typescript
import { fakerDE as faker } from '@faker-js/faker';

faker.seed(1234); // same data on every run
```

The callback receives the value set through `setMeta()` as its only argument, which lets a seeder
parameterize the generated entity. It is `undefined` when `setMeta()` was not called.

```typescript
export default setSeederFactory(User, (meta?: { lastName?: string }) => {
    const user = new User();
    user.firstName = faker.person.firstName();
    user.lastName = meta?.lastName ?? faker.person.lastName();
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });

    return user;
})
```

```typescript
const users = await factoryManager.get(User)
    .setMeta({ lastName: 'Barrows' })
    .saveMany(5);
```

## Seed
And last but not least, create a seeder. The seeder can be called by the cli command `seed` or in the codebase
by using the function `runSeeder`.
A seeder class only requires one method, called `run` and provides the arguments `dataSource` & `factoryManager`.

**`user.seeder.ts`**

A seeder class must implement the [Seeder](#seeder) interface, and could look like this:

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

        const userFactory = factoryManager.get(User);
        // save 1 factory generated entity, to the database
        await userFactory.save();

        // save 5 factory generated entities, to the database
        await userFactory.saveMany(5);
    }
}
```

Factories obtained through the `factoryManager` argument are bound to the data source of the
current seeder run, so `save()` and `saveMany()` persist there. A factory used outside a seeder
run (e.g. via `useSeederFactory(User)`) falls back to the data source registered for the
`default` alias (see [setDataSource](datasource-api-reference.md#setdatasource)).

## Execute

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
