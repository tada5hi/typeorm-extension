# Seeding

Seeders fill a database with a fixed or generated data set; factories generate entities for them.

You need three parts: one or more [entities](#entity), optionally a [factory](#factories) per entity, and one or more
[seeders](#seeders). You then [execute](#execute) the seeders from the CLI or from code.

## Configuration

You tell the library where seeders and factories live, either as **glob patterns** or as imported values
(seeder classes, factory items).

```typescript
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';

const options: DataSourceOptions & SeederOptions = {
    type: 'better-sqlite3',
    database: 'db.sqlite',

    seeds: ['src/database/seeds/**/*{.ts,.js}'],
    factories: ['src/database/factories/**/*{.ts,.js}'],
};

export const dataSource = new DataSource(options);
```

The library reads the options from three sources. The first source that has a value wins:

| Option          | 1. `runSeeder(s)` input | 2. data-source options | 3. environment                              | 4. default                                |
|-----------------|-------------------------|------------------------|---------------------------------------------|-------------------------------------------|
| `seeds`         | yes                     | yes                    | `DB_SEEDS` or `TYPEORM_SEEDING_SEEDS`         | `src/database/seeds/**/*{.ts,.js}`        |
| `factories`     | yes                     | yes                    | `DB_FACTORIES` or `TYPEORM_SEEDING_FACTORIES` | `src/database/factories/**/*{.ts,.js}`    |
| `seedTracking`  | yes                     | yes                    | no                                          | `false`                                   |
| `seedTableName` | yes                     | yes                    | no                                          | `seeds`                                   |
| `seedName`      | yes                     | no                     | no                                          | none (all seeders run)                    |

- An empty `seeds` or `factories` array counts as unset, so the next source applies.
- Glob patterns use the posix separator (`/`), also on Windows. A backslash escapes glob characters.
- The environment variables hold a comma separated list. A brace list such as `*{.ts,.js}` contains a comma and is
  split apart, so write one pattern per entry: `DB_SEEDS=src/database/seeds/**/*.ts`.
- The environment is read once and cached. Call `resetEnv()` after you change `process.env` at runtime.

When the compiled output runs instead of the TypeScript sources, see [Running from a build](./recipes/production-build).

## Entity

Seeders and factories work with any TypeORM entity.

```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column()
    email: string;
}
```

## Factories

A factory creates one entity with generated values. You define it once per entity with
[`setSeederFactory`](./seeding-api-reference#setseederfactory).

The library ships no data generator. The examples use [faker](https://fakerjs.dev/guide/), which you install
yourself (`npm install @faker-js/faker`, see [Installation](./installation)).

```typescript
import { faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';
import { User } from './user';

export default setSeederFactory(User, (meta?: { lastName?: string }) => {
    const user = new User();
    user.firstName = faker.person.firstName();
    user.lastName = meta?.lastName ?? faker.person.lastName();
    user.email = faker.internet.email({ firstName: user.firstName, lastName: user.lastName });

    return user;
});
```

- The callback returns the entity, or a promise of it. It receives the value of `setMeta()` as its only argument,
  `undefined` when `setMeta()` was not called.
- `setSeederFactory` registers the factory in a process-wide manager and returns a factory item. Export the item, so
  you can also pass it in `factories: [...]`.
- Locale and reproducible runs are the generator's business, for example `fakerDE` and `faker.seed(1234)`. faker
  also needs `faker.setDefaultRefDate(...)` for relative dates, and seeded values may change across faker versions.

You use a factory inside a seeder through `factoryManager.get(User)`, or anywhere else through
[`useSeederFactory(User)`](./seeding-api-reference#useseederfactory):

```typescript
import { useSeederFactory } from 'typeorm-extension';
import { User } from './user';

const factory = useSeederFactory<User, { lastName?: string }>(User);

const draft = await factory.make();                                  // not persisted
const user = await factory.save();                                   // persisted
const users = await factory.saveMany(5, { lastName: 'Barrows' });    // 5 rows, lastName overridden
const family = await factory.setMeta({ lastName: 'Barrows' }).saveMany(3);
```

- `make(params?)` builds the entity and does not touch the database.
- `save(params?, saveOptions?)` builds the entity and saves it with the repository of its data source.
- `saveMany(n, params?, saveOptions?)` starts all `n` saves at once (`Promise.all`). With a unique column, two
  generated values can collide and one save fails while others are already stored. Derive unique values from a
  counter, or call `save()` in a loop.
- `params` are assigned after the callback ran and replace the generated property values, one property at a time.
- `setMeta(value)` passes `value` to the callback. Use it when the callback needs the value to decide something,
  and `params` when you only overwrite a property.

A property that holds another factory is resolved with the parent: `make()` makes it, `save()` saves it first and
assigns the saved entity. This gives each parent its own child row.

```typescript
import { setSeederFactory, useSeederFactory } from 'typeorm-extension';
import { Role } from './role';
import { User } from './user';

export default setSeederFactory(User, () => {
    const user = new User();
    user.firstName = 'Ada';
    user.lastName = 'Lovelace';
    user.email = 'ada@example.com';
    user.role = useSeederFactory(Role) as unknown as Role;

    return user;
});
```

- The nested factory is resolved before `params` apply. Overriding `role` through `params` still saves an unused
  `Role` row first; pass the parent through `setMeta()` instead (see [Factories with relations](./recipes/factories-with-relations)).
- A native `Promise` in a property is not awaited. Make the callback `async` and await the value there.

## Seeders

A seeder is a class that implements the [`Seeder`](./seeding-api-reference#seeder) interface. It has one method,
`run(dataSource, factoryManager)`.

```typescript
import type { DataSource } from 'typeorm';
import type { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { User } from './user';

export default class UserSeeder implements Seeder {
    track = true;

    public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<unknown> {
        await dataSource.getRepository(User).insert([
            { firstName: 'Caleb', lastName: 'Barrows', email: 'caleb.barrows@gmail.com' },
        ]);

        const userFactory = factoryManager.get(User);
        await userFactory.save();

        return userFactory.saveMany(5);
    }
}
```

- `dataSource` is the data source the run was started with.
- Factories from `factoryManager.get()` save to that data source. A factory from `useSeederFactory()` outside a run
  uses the data source registered for the `default` alias (see [`setDataSource`](./datasource-api-reference#setdatasource)).
- `factoryManager.get()` throws if no factory is registered for the entity.
- What `run()` returns is available as `result` on the entity returned by `runSeeder` / `runSeeders`.
- Seeders run one after the other, without a surrounding transaction. When one throws, the run stops; seeders that
  finished before keep their data.
- A seeder file contributes one class. Keep one seeder per file.

## Order and selecting one seeder

Seeders from glob patterns run in the order of their **file names** (the base name, not the path). `seed create`
prefixes each new file with a 13 digit timestamp, so generated seeders run in the order you created them:

```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed create --name src/database/seeds/user
# creates src/database/seeds/1700000000000-user.ts with the class User1700000000000
```

Seeder classes passed in `seeds: [...]` run in the order of the array. The exception is a class whose name ends with
13 or more digits (as `seed create` generates it): that number is its sort key, so it runs after the classes without
one.

To run one seeder, set `seedName` (`--name` or `-n` on the CLI). It matches the class name, the file name or the
file path:

```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run --name UserSeeder
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run --name src/database/seeds/1700000000000-user.ts
```

From code, [`runSeeder`](./seeding-api-reference#runseeder) takes a class (runs only that class) or a name (selects
from the configured seeds):

```typescript
import type { DataSource } from 'typeorm';
import { runSeeder } from 'typeorm-extension';
import UserSeeder from './user.seeder';

declare const dataSource: DataSource;

const entity = await runSeeder(dataSource, UserSeeder);
await runSeeder(dataSource, 'UserSeeder');
```

To run several seeders in a fixed order, write one seeder that calls `runSeeder` for each of them, or pass the
classes as an array.

## Tracking

Tracking runs a seeder only once per database. It is off by default.

- Turn it on for all seeders with `seedTracking: true` (input or data-source options).
- The `track` property of a seeder class wins over `seedTracking`, in both directions.
- Executed seeders are recorded in the `seeds` table (a collection on MongoDB) with `id`, `timestamp` and `name`.
  Change the table name with `seedTableName`. The table is created on the first run that tracks a seeder.
- The **class name** is the key. Renaming a class makes it run again. Two seeders with the same class name abort the
  run with `Duplicate seeds: <name>`.
- A selected seeder (`seedName`) that was already tracked is skipped as well.

Seeds are never reverted. A seeder has no `down()` step, so the library cannot know how to undo what `run()` wrote.
To run a tracked seeder again, delete its row from the `seeds` table.

## Execute

From the CLI, the data-source file supplies the seeder options:

```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run -d src/data-source.ts
```

From code, call [`runSeeders`](./seeding-api-reference#runseeders) with an initialized data source. Options you pass
win over the data-source options:

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { User } from './user';
import UserFactory from './user.factory';
import UserSeeder from './user.seeder';

const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: 'db.sqlite',
    entities: [User],
    synchronize: true,
});
await dataSource.initialize();

const executed = await runSeeders(dataSource, {
    seeds: [UserSeeder],
    factories: [UserFactory],
});

console.log(executed.map((seeder) => seeder.name));
```

- Pass classes and factory items instead of globs when the code is bundled, or in tests
  (see [Testing with better-sqlite3](./recipes/testing)).
- `runSeeders` returns the seeders it executed. Tracked seeders that already ran are not in the list.
- See the [CLI](./cli) page for every `seed run` option.
