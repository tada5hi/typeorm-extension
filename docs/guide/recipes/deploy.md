# Deploying with several replicas

Several replicas of your app start at the same time, and each one wants to migrate and seed the same database.

Create the database once per deployment, in a release step that runs before the replicas start:

```shell
npx typeorm-extension db create -d src/data-source.ts --synchronize no
```

Then let every replica run this on startup:

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

`./data-source` exports both the options (`DataSourceOptions & SeederOptions`) and
`export const dataSource = new DataSource(options)`: the CLI needs the instance, the replicas build their own
`DataSource` from the options.

## Why it works

- `db create` skips an existing database. On postgres that is a lookup followed by `CREATE DATABASE`, which two
  replicas could race on, so it runs once in the release step. `--synchronize no` leaves the schema to the replicas.
- `withDatabaseLock` lets one session at a time into the callback. The others wait, and then find no pending
  migrations and no untracked seeders. The lock is released also when the callback throws. It needs `postgres`,
  `mysql` or `mariadb`.
- The lock belongs to the query runner's connection, while `runMigrations()` and the seeders use other connections
  from the pool. Keep the pool at two connections or more, and release the query runner at the end.
- `assertSchemaMatchesMetadata` throws a `SchemaDriftError` when the migrations do not produce the schema the
  entities describe, so the replica fails to start instead of running against the wrong schema. `seedTracking: true`
  records each seeder in the `seeds` table, so it runs once per database.

## Links

- [Locks](../locks#database-lock) and [withDatabaseLock](../database-api-reference#withdatabaselock)
- [Schema drift](../schema#schema-drift) and [assertSchemaMatchesMetadata](../database-api-reference#assertschemamatchesmetadata)
- [Seeding](../seeding) and [runSeeders](../seeding-api-reference#runseeders)
- [Database: Create](../database#create)
