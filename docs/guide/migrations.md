# Migrations

This page covers running migrations through the library: a runner which plans before it executes, and baselines,
which replace a long migration chain with one migration that creates the schema in a single step.

## Running Migrations

`runDatabaseMigrations` runs the pending migrations like `dataSource.runMigrations()`, with two differences. It reads
every migration and the migrations table first and refuses an inconsistent state before a statement runs. And it
holds a database lock while it plans and runs:

```typescript
import type { DataSource } from 'typeorm';
import { runDatabaseMigrations } from 'typeorm-extension';

declare const dataSource: DataSource;

const executed = await runDatabaseMigrations(dataSource);
console.log(executed.map((migration) => migration.name));
```

- Without a baseline the behaviour is typeorm's: a migration is pending when its name has no row, and the pending
  ones run in timestamp order. Under `transaction: 'all'` a migration with its own `transaction` setting is refused,
  as typeorm refuses it.
- `transaction` defaults to the `migrationsTransactionMode` of the data source, else `'all'`.
- The lock is `MIGRATION_LOCK_NAME` (`typeorm-extension:migrations`). Pass `lock: 'name'` for another one or
  `lock: false` to run unlocked.
- The lock exists for postgres, mysql and mariadb. On every other driver (sqlite, cockroachdb, mssql, oracle, ...)
  the run proceeds unlocked, so two processes adopting a baseline at the same time can insert two baseline rows
  there. Run the migrations from one process on those drivers.
- An uninitialized data source with `migrationsRun`, `synchronize` or `dropSchema` set is refused with a
  `MigrationPlanError`, since `initialize()` would run them before the lock is taken and without the runner. Initialize
  it first or unset them.
- The runner logs through the logger of the data source, with typeorm's messages.

`synchronizeDatabaseSchema` and `createDatabase({ synchronize: true })` run through this runner, so a baseline is
honoured there without further configuration. `synchronizeDatabaseSchema` takes the lock by default (pass
`{ lock: false }` to opt out), accepts `transaction` and `ignoreTables`, and initializes a data source passed in with
`migrationsRun` turned off.

### With a query runner

A caller which holds the lock itself passes its query runner. The runner then uses it as is, takes no lock and never
releases it:

```typescript
import type { DataSource } from 'typeorm';
import {
    MIGRATION_LOCK_NAME,
    runDatabaseMigrations,
    withDatabaseLock,
} from 'typeorm-extension';

declare const dataSource: DataSource;

const queryRunner = dataSource.createQueryRunner();
try {
    await withDatabaseLock(queryRunner, MIGRATION_LOCK_NAME, async () => {
        await runDatabaseMigrations(dataSource, { queryRunner });
    });
} finally {
    await queryRunner.release();
}
```

The query runner of a lock must not be in a transaction, see [Locks](./locks#transactions).

## Planning

`planDatabaseMigrations` is the read-only part: it raises every refusal and writes nothing, not even the migrations
table. Use it for a dry run, or for a process which must not migrate but needs to know whether anything is pending
(`dataSource.showMigrations()` knows nothing of baselines):

```typescript
import type { DataSource } from 'typeorm';
import { isMigrationPlanEmpty, planDatabaseMigrations } from 'typeorm-extension';

declare const dataSource: DataSource;

const plan = await planDatabaseMigrations(dataSource);

if (!isMigrationPlanEmpty(plan)) {
    console.log(plan.legacy.map((migration) => migration.name));
    console.log(plan.adopt);
    console.log(plan.pending.map((migration) => migration.name));
}
```

- `legacy` holds the legacy migrations still to run, `adopt` says the baseline is recorded without running it, and
  `pending` holds the migrations to run, in timestamp order. The plan is empty when all three are empty.
- A plan made outside the lock can be stale when it is used. `runDatabaseMigrations` therefore plans again under the
  lock, instead of executing a given plan.

## Baselines

A baseline is a migration which creates the whole schema in one step. A fresh install runs it instead of the chain.
A database which already ran the chain gets the baseline recorded as executed, without running it.

Extend `MigrationBaseline` and keep the class in the `migrations` list of the data source options:

```typescript
import type { QueryRunner } from 'typeorm';
import { MigrationBaseline } from 'typeorm-extension';

export class Baseline1795000000000 extends MigrationBaseline {
    // The chain this baseline replaces: classes or globs, the shape of DataSourceOptions.migrations.
    static override legacy = ['src/migrations/legacy/*.ts'];

    // Appended to every refusal which needs an upgrade path.
    static override upgradeHint = 'Upgrade through any 1.x release first.';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE TABLE "user" ("id" integer PRIMARY KEY)');
    }
}
```

- The runner finds the baseline in the migration list. Pass `baseline` (the class) to the run or plan functions to
  name it explicitly, which wins over discovery.
- `legacy` and `upgradeHint` are static members which override the ones of `MigrationBaseline`, so a project with
  `noImplicitOverride` needs the `override` modifier.
- A class is a baseline by its static `baseline` marker, which `MigrationBaseline` sets, never by `instanceof`
  (`isMigrationBaselineClass`). Its `down()` throws a `MigrationPlanError`.
- `legacy` globs resolve through the library's path resolver, like `DataSourceOptions.migrations` loaded through the
  library. Classes work too. The legacy migrations must not be in the `migrations` list of the data source.
- Remove `legacy` when the project drops the chain (its next major). The class stays a baseline, and a database
  which never adopted it is refused with `upgradeHint`.
- Only one baseline is allowed in the migration list, also when one is passed explicitly. Every legacy migration must
  be older than the baseline, and no other migration may be older than it.
- A migration with a static `baseline`, `legacy` or `upgradeHint` which does not extend `MigrationBaseline` is
  refused, rather than run as an ordinary migration.
- Baselines need the empty-schema check, which exists for postgres, cockroachdb, mysql, mariadb, better-sqlite3,
  mssql and oracle. MongoDB is refused with a `MigrationPlanError`; without a baseline it runs as before.

### Generating a baseline

`generateMigration` against an empty database writes a migration with the full schema, which is the body of the
baseline:

```typescript
import type { DataSource } from 'typeorm';
import { generateMigration } from 'typeorm-extension';

declare const emptyDataSource: DataSource;

await generateMigration({
    dataSource: emptyDataSource,
    name: 'baseline',
    directoryPath: 'src/migrations',
});
```

Make the generated class extend `MigrationBaseline`, move the chain it replaces into the `legacy` location and
declare it as above.

### States

| State of the database                                    | The runner                                                              |
|----------------------------------------------------------|-------------------------------------------------------------------------|
| No executed rows, no user tables                         | runs the baseline, then every migration after it                        |
| No executed rows, user tables exist                      | refuses, naming the tables                                              |
| Baseline row present                                     | runs what is pending, nothing else changes                              |
| Legacy rows, no baseline row, chain complete             | records the baseline row without running it, then runs what follows     |
| Legacy rows, no baseline row, chain incomplete           | runs the missing legacy migrations, then as above                       |
| Legacy rows, no baseline row, chain not declared         | refuses with the `upgradeHint`                                          |
| Legacy rows, no baseline row, rows the code does not know | refuses, listing them                                                   |

- A baseline never runs against a populated schema, whatever the migrations table says.
- The migrations table and the metadata table do not count as user tables. `ignoreTables` lists further ones, for
  several data sources sharing one database. The names are unqualified and refer to the current schema.
- Unknown rows are refused only when adopting. Otherwise they are ignored, as typeorm ignores them.
- Every refusal is a `MigrationPlanError` (see [Errors](./errors)) whose `names` lists the tables or migrations
  concerned.

### Transactions

- `all`: the legacy migrations and the baseline row run in one transaction, the pending migrations in a second one.
  A failing later migration does not roll back a correct adoption.
- `each`: one transaction per migration, and one for the baseline row.
- `none`: no transaction.

Every step is resumable: after a failure, a new plan from the rows which exist leads to the same end state.

One case needs a hand: the baseline of a fresh install failing where DDL is not transactional (mysql and mariadb, or
`transaction: 'none'`). The tables it created stay, without a row, and the next run refuses the populated schema,
naming them. Drop the listed tables and run again.

### Rollback

Adoption only inserts a row and never deletes the legacy ones. An older release of the project still sees every
legacy row it knows and ignores the baseline row, so rolling the image back after an upgrade keeps working. Its
`migration:revert` (typeorm's `undoLastMigration`) fails after the adoption, though: the newest row is the baseline,
which that release does not know.

A database created fresh from the baseline has no legacy rows. Rolling it back to a release from before the baseline
is not supported: that release sees the whole legacy chain as pending.

`undoDatabaseMigration` reverts the newest executed migration like `undoLastMigration` does, in the transaction mode
`options.transaction ?? 'all'`:

```typescript
import type { DataSource } from 'typeorm';
import { undoDatabaseMigration } from 'typeorm-extension';

declare const dataSource: DataSource;

const reverted = await undoDatabaseMigration(dataSource);
console.log(reverted?.name);
```

It refuses with a `MigrationPlanError` when the newest row is the baseline or older, before any `down()` runs. A
round-trip in CI therefore reverts down to the baseline and runs again.

### A second squash

A later baseline lists the previous baseline and the migrations after it as its `legacy` chain. A database which
adopted the previous baseline adopts the newer one: the rows older than the previous baseline are its history and are
kept. The previous baseline itself is never run. A database still on the first chain, without the previous baseline's
row, is refused with the `upgradeHint` of the newer baseline. Each baseline is a required upgrade stop: name the
release line which carries the previous adoption in the hint.

### The typeorm CLI

typeorm's own `migration:run` and `migration:revert` know nothing of baselines. On a database with a baseline they
run the baseline as an ordinary migration, and fail on its `CREATE TABLE`. Run the migrations through the library
(the functions above, `synchronizeDatabaseSchema` or `createDatabase`) wherever a baseline exists.
