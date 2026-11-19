# Testing with better-sqlite3 in memory

You want fast tests against a real database, with seeders and factories, and without a database server.

## Data source per test

```typescript
import { DataSource } from 'typeorm';
import {
    resetEnv,
    resetSeederFactoryManager,
    runSeeders,
    setDataSource,
    unsetDataSource,
} from 'typeorm-extension';
import { Role } from '../src/entities/role';
import { User } from '../src/entities/user';
import RoleFactory from '../src/database/factories/role.factory';
import UserFactory from '../src/database/factories/user.factory';
import RoleSeeder from '../src/database/seeds/role.seeder';
import UserSeeder from '../src/database/seeds/user.seeder';

export async function setupDatabase(): Promise<DataSource> {
    const dataSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [Role, User],
        synchronize: true,
    });
    await dataSource.initialize();
    setDataSource(dataSource);

    await runSeeders(dataSource, {
        seeds: [RoleSeeder, UserSeeder],
        factories: [RoleFactory, UserFactory],
    });

    return dataSource;
}

export async function teardownDatabase(dataSource: DataSource): Promise<void> {
    await dataSource.destroy();
    unsetDataSource();
    resetSeederFactoryManager();
    resetEnv();
}
```

Call `setupDatabase()` in `beforeEach` and `teardownDatabase()` in `afterEach`. The helpers use no test runner API,
so they work with vitest and jest alike.

Why it works:

- `database: ':memory:'` gives every data source its own empty database, and `synchronize: true` creates the tables
  from the entities. Destroying the data source discards it.
- Classes and factory items need no glob and no file lookup. Pass `factories` as well: without it, the default glob
  `src/database/factories/**/*{.ts,.js}` is loaded. The seeders run in array order (see
  [Order](../seeding#order-and-selecting-one-seeder)).
- `setDataSource()` registers the data source for the `default` alias, so `useSeederFactory(User).save()` in a test
  saves there. Without it, `save()` outside a seeder
  builds a data source from the environment or a data-source file.
- `resetSeederFactoryManager()` drops every registered factory. A factory module registers itself only when it is
  first imported, so pass the factory items to `runSeeders` (or call `setSeederFactory` again) after a reset.
  `resetEnv()` clears the cached `process.env` values when a test changes them.

## Factories without a database

`make()` builds an entity without touching a database, which is enough for unit tests of pure logic:

```typescript
import { setSeederFactory, useSeederFactory } from 'typeorm-extension';
import { User } from '../src/entities/user';
import UserFactory from '../src/database/factories/user.factory';

setSeederFactory(UserFactory.entity, UserFactory.factoryFn);

const user = await useSeederFactory(User).make({ email: 'a@example.com' });
```

- Neither `make()` nor a nested factory inside it uses a data source. `save()` and `saveMany()` need one.
- `setSeederFactory` re-registers the factory, which is needed after `resetSeederFactoryManager()`.

## Locks and drift checks on sqlite

Code that uses [locks](../locks) refuses sqlite by default. Relax it in tests, and let a shared
[drift check](../schema) skip the synchronized test schema:

```typescript
import type { DataSource } from 'typeorm';
import { getSchemaDrift, withDatabaseLock, withLockedEntity } from 'typeorm-extension';
import { User } from '../src/entities/user';

declare const dataSource: DataSource;

const queryRunner = dataSource.createQueryRunner();
try {
    await withDatabaseLock(queryRunner, 'migrations', async () => {
        // ...
    }, { strict: false });
} finally {
    await queryRunner.release();
}

await withLockedEntity(dataSource, User, { id: 1 }, async (user, manager) => {
    user.email = 'b@example.com';
    await manager.save(user);
}, { strict: false });

const drift = await getSchemaDrift(dataSource, { skipWithoutMigrations: true });
```

- `withDatabaseLock` and `withLockedEntity` throw a `DriverError` on sqlite. With `strict: false` they run the
  callback without a lock. `withLockedEntity` still reads the row and runs the callback in a transaction.
- `getSchemaDrift` works on sqlite. With `skipWithoutMigrations: true` it reports no drift, without inspecting the
  schema, when the data source has no migrations. The same call then checks real drift where migrations build the
  schema.

## See also

- [`runSeeders`](../seeding-api-reference#runseeders), [`useSeederFactory`](../seeding-api-reference#useseederfactory),
  [`resetSeederFactoryManager`](../seeding-api-reference#resetseederfactorymanager)
- [`withDatabaseLock`](../database-api-reference#withdatabaselock), [`withLockedEntity`](../database-api-reference#withlockedentity),
  [`getSchemaDrift`](../database-api-reference#getschemadrift)
- [Factories with relations](./factories-with-relations)
