# Migrations

::: warning Experimental

The migration runner and the baselines API (`MigrationBaseline`, `planDatabaseMigrations`, `runDatabaseMigrations`,
`undoDatabaseMigration` and their types) may change in a minor release. `synchronizeDatabaseSchema` without a baseline
behaves like typeorm's `runMigrations`.

:::

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
honoured there without further configuration. `synchronizeDatabaseSchema` runs unlocked unless `lock` is set
(`true` takes `MIGRATION_LOCK_NAME`, a string takes that name), so a project running baselines through it on several
replicas must pass `lock: true`. It accepts `transaction` and `ignoreTables`, and initializes a data source passed in with
`migrationsRun` turned off. On a project with a baseline it refuses `synchronize` and `dropSchema` (options or an
uninitialized data source) with a `MigrationPlanError` before initializing, since `initialize()` would apply them
before the baseline checks run. Without a baseline they behave as before.

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
  be older than the baseline, and every other migration must be strictly newer than it (the same timestamp is refused).
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

### Proving a baseline

A baseline replaces the chain, so a test should show that both create the same schema. Build the schema three ways and
compare the snapshots:

- A: a fresh database, the legacy chain run by typeorm's own runner.
- B: a fresh database, the baseline run by `runDatabaseMigrations`.
- C: a database which ran the chain, then adopts the baseline.

```typescript
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { describe, expect, it } from 'vitest';
import {
    assertSchemaSnapshotsEqual,
    compareSchemaSnapshots,
    getSchemaSnapshot,
    runDatabaseMigrations,
} from 'typeorm-extension';
import { Baseline1795000000000 } from '../src/migrations/baseline';

// One empty database per call, with the migrations of the project for the given run.
declare function createOptions(migrations: DataSourceOptions['migrations']): DataSourceOptions;
declare const legacyMigrations: NonNullable<DataSourceOptions['migrations']>;

describe('baseline', () => {
    it('creates the schema of the legacy chain', async () => {
        const chain = new DataSource(createOptions(legacyMigrations));
        await chain.initialize();
        await chain.runMigrations();
        const expected = await getSchemaSnapshot(chain);
        await chain.destroy();

        const fresh = new DataSource(createOptions([Baseline1795000000000]));
        await fresh.initialize();
        await runDatabaseMigrations(fresh);
        const actual = await getSchemaSnapshot(fresh);
        await fresh.destroy();

        expect(compareSchemaSnapshots(expected, actual)).toEqual([]);

        // ... or throw a SchemaSnapshotError listing the differences
        assertSchemaSnapshotsEqual(expected, actual);
    });
});
```

For C, run the chain on a third database, initialize a data source with the baseline in its `migrations` list, call
`runDatabaseMigrations` and compare its snapshot with A. Adoption only inserts the baseline row, so the schema must
stay as the chain left it.

`getSchemaSnapshot(dataSourceOrOptions, { queryRunner?, ignoreTables? })` reads a normalized, sorted description and
writes nothing. `compareSchemaSnapshots(expected, actual)` returns the differences, sorted by path. Each has a `kind`:

- `missing`: the element is in the expected snapshot only.
- `extra`: the element is in the actual snapshot only.
- `changed`: both have it and `expected` and `actual` hold the two values.

| Path                                                        | Names                                           |
|-------------------------------------------------------------|-------------------------------------------------|
| `tables.<table>`                                            | a table                                         |
| `tables.<table>.columns.<column>[.<property>]`              | a column, or one property of it                 |
| `tables.<table>.comment`                                    | the table comment                               |
| `tables.<table>.primaryKey`                                 | the primary key                                 |
| `tables.<table>.indices\|uniques\|foreignKeys.<key>`        | the name, or the columns joined by `,` if unnamed |
| `tables.<table>.checks\|exclusions.<key>`                   | the name, or the expression if unnamed          |
| `views.<view>`                                              | a view                                          |

Keys which occur more than once (unnamed duplicates) get a `#<n>` suffix, such as `tables.gadget.indices.a,b#1`.

What a snapshot covers:

- The current schema only. The migrations and metadata tables are left out, and `ignoreTables` lists further ones
  (unqualified names), for a database other projects share.
- No schema or database qualifier is recorded, so two schemas compare equal. On postgres and cockroachdb the read
  sets `search_path` to the target schema alone, so a type or function of that schema prints unqualified, and puts
  the previous value back afterwards.
- Constraint and index names are compared. A readable name against a hashed one is a difference.
- Views are the typeorm view entities, which typeorm records in its metadata table.
- Column properties compared: type, length, precision, scale, nullability, default, generation (strategy, type,
  expression, identity `ALWAYS` or `BY DEFAULT`), charset, collation, unsigned, enum values and enum type name, array,
  comment, `ON UPDATE`, spatial type and SRID. Also compared: table comments, postgres exclusion constraints, and
  deferrable primary keys, unique constraints and foreign keys (postgres).
- Indexes of postgres and cockroachdb come from `pg_indexes`, without the ones which own a primary key, unique or
  exclusion constraint (those appear as the primary key, as uniques or as exclusions). Indexes of mysql and mariadb
  come from `information_schema.statistics`, with prefix length and direction per part, the index type and whether
  the index is invisible (mysql) or ignored (mariadb). Expression and partial indexes are compared by their
  definition. Other drivers use the indices typeorm reads.
- The column order of a primary key or unique constraint is compared on postgres, mysql and mariadb, read from the
  catalogue. On other drivers the key columns are sorted, so `(a, b)` and `(b, a)` compare equal there.

What it does not compare: the column order of a table, mysql `zerofill` and display width, table options (engine,
row format, collation), the `parser` and `isNullFiltered` of an index, sequences, the values of an enum type beyond
the enum of a column, and anything typeorm does not model (triggers, hand-made views, extensions).

Limits:

- `getSchemaSnapshot` supports postgres, cockroachdb, mysql, mariadb, better-sqlite3, mssql and oracle, and throws a
  `DriverError` for any other driver.
- Verified on postgres, mysql and mariadb (integration suite) and better-sqlite3 (unit suite). cockroachdb, mssql and
  oracle run unverified.
- On mysql and mariadb a generated column created by raw DDL, with no `typeorm_metadata` table, makes typeorm's table
  reader throw, so the snapshot throws too.
- The snapshot API is experimental and may change in a minor release.

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
