# Schema

This page covers the schema of an existing database: detecting drift between the schema and the entities,
generating a migration, and repairing a schema with guarded helpers.

## Schema Drift

The database schema and the entity metadata are two descriptions of the same thing. A project which builds its
schema with migrations in production but with `synchronize()` in tests has no guard against the two drifting apart.
Nothing breaks until someone runs `migration:generate` and gets a migration full of reconciling statements, possibly
including a `DROP COLUMN` that looks routine in review.

`getSchemaDrift` runs the same schema comparison as `migration:generate` and returns the statements which would
reconcile the database schema with the entity metadata. It never writes to the database.

```typescript
import type { DataSource } from 'typeorm';
import { getSchemaDrift } from 'typeorm-extension';

declare const dataSource: DataSource;

const drift = await getSchemaDrift(dataSource);

if (drift.exists) {
    for (const statement of drift.up) {
        console.log(statement.query);
    }
}
```

`assertSchemaMatchesMetadata` is the assertion form. It throws a `SchemaDriftError` whose message lists the
statements and whose `statements` property carries them:

```typescript
import type { DataSource } from 'typeorm';
import { SchemaDriftError, assertSchemaMatchesMetadata } from 'typeorm-extension';

declare const dataSource: DataSource;

try {
    await assertSchemaMatchesMetadata(dataSource);
} catch (e) {
    if (e instanceof SchemaDriftError) {
        console.log(e.statements);
    }

    throw e;
}
```

- Both accept a `DataSource` or plain `DataSourceOptions`.
- From options, a data source is built with `synchronize`, `migrationsRun` and `dropSchema` turned off, and destroyed
  afterwards.
- An initialized `DataSource` is used as is and never destroyed. An uninitialized one is initialized, unless it has
  `synchronize`, `migrationsRun` or `dropSchema` turned on: then it is left untouched and a copy without them is
  inspected instead.
- `skipWithoutMigrations: true` reports no drift when the data source has no migrations registered. Use it when one
  data-source file serves a migration driven environment and a `synchronize()` driven one (for example
  `migrations: []` for an in-memory sqlite test database).
- On mongodb there is no schema to compare: the drift is always empty.

Run the check right after the migrations, for example in CI:

```
migration run  ->  revert x N  ->  run  ->  assert zero drift
```

The command line equivalent is [`typeorm-extension db drift`](./cli#schema-drift). The recipe
[Schema drift check in CI](./recipes/drift-in-ci) shows a complete job.

## Generate Migration

`generateMigration` writes a migration file from the same schema comparison, without shelling out to the typeorm
CLI. The statements, the escaping and the file templates are typeorm's own, so the result matches
`typeorm migration:generate`.

```typescript
import type { DataSource } from 'typeorm';
import { generateMigration } from 'typeorm-extension';

declare const dataSource: DataSource;

await generateMigration({
    dataSource,
    name: 'add-role',
    directoryPath: 'src/migrations',
});
```

- The data source must already be initialized, and it stays initialized.
- The file is written as `<timestamp>-<name>.<language>`, by default into `migrations/` relative to the working
  directory.
- `language: 'js'` emits a JavaScript migration (JSDoc typed, `module.exports = class`). Add `esm: true` for
  `export class` module syntax.
- `preview: true` returns the statements without writing anything:
  `const { up, down, content } = await generateMigration({ dataSource, preview: true })`.
- When there is nothing to generate, `up` and `down` are empty, `content` is undefined and no file is written.
- `prettify: true` formats the SQL statements.

For every option, see [generateMigration](./database-api-reference#generatemigration).

## Repair Migrations

Fixing schema drift usually means renaming a constraint, which works differently per dialect:

- **postgres** renames in place: `ALTER INDEX … RENAME TO`, `ALTER TABLE … RENAME CONSTRAINT`.
- **mysql** has `ALTER TABLE … RENAME INDEX`, but no `RENAME CONSTRAINT`. A foreign key must be dropped and re-added.
  If its column had no explicit index, mysql created a backing index under the constraint name, which survives the
  drop and has to be dealt with before the new constraint is added.

The following helpers own that machinery. Which constraint is renamed to what stays in your migration.

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { changeColumnType, renameForeignKey, renameIndex } from 'typeorm-extension';

export class RepairSchema1700000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await renameIndex(queryRunner, {
            table: 'auth_events',
            from: 'IDX_auth_events_actor_name',
            to: 'IDX_9f6d1a2b3c4d5e6f70819293',
        });

        await renameForeignKey(queryRunner, {
            table: 'auth_permissions',
            from: 'FK_auth_permissions_client',
            to: 'FK_1a2b3c4d5e6f708192a3b4c5',
            // recreates the constraint if a mysql run stopped between DROP and ADD
            meta: {
                columns: ['client_id'],
                referencedTable: 'auth_clients',
                referencedColumns: ['id'],
                onDelete: 'CASCADE',
            },
        });

        await changeColumnType(queryRunner, {
            table: 'auth_permissions',
            column: 'client_id',
            from: { type: 'varchar', length: 36 },
            to: { type: 'varchar', length: 255 },
        });
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ... the same calls with from and to swapped
    }
}
```

### Guards

Each helper reads the current state back from the database, applies the change only if it is still pending, and
returns whether it did something. A repair migration therefore stays resumable (mysql commits DDL regardless of the
surrounding transaction) and is safe to run against a database which never had the drift.

A guard only covers the state the change would produce. If the database is in **neither** the expected nor the
desired state (a mistyped constraint name, a column which is not the type the migration expects), the helper throws a
`SchemaAlterationError`. A repair migration which repairs nothing would otherwise look like a successful one. Pass
`strict: false` to get a silent no-op instead:

```typescript
import type { QueryRunner } from 'typeorm';
import { renameIndex } from 'typeorm-extension';

declare const queryRunner: QueryRunner;

await renameIndex(queryRunner, {
    table: 'auth_events',
    from: 'IDX_auth_events_actor_name',
    to: 'IDX_9f6d1a2b3c4d5e6f70819293',
    // this database may never have had the index at all
    strict: false,
});
```

See [Guard semantics](./database-api-reference#guard-semantics) for the exact rules.

### Foreign keys

`renameForeignKey` keeps the columns, the referenced table and columns, and the referential actions of the
constraint. All of them are read back from the database, so the rename can not change the constraint.

On mysql the `DROP` and the `ADD` are separate, auto-committed statements. A run interrupted between them leaves
neither the old nor the new constraint behind, and there is nothing left to read back. Pass `meta` to make that
recoverable. It is only used when neither name is present:

```typescript
import type { QueryRunner } from 'typeorm';
import { renameForeignKey } from 'typeorm-extension';

declare const queryRunner: QueryRunner;

await renameForeignKey(queryRunner, {
    table: 'auth_permissions',
    from: 'FK_auth_permissions_client',
    to: 'FK_1a2b3c4d5e6f708192a3b4c5',
    meta: {
        columns: ['client_id'],
        referencedTable: 'auth_clients',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
    },
});
```

Between the drop and the add, the constraint does not exist, and the add runs with the checks disabled. Another
session can insert an orphan row in that window, and it is not caught afterwards. Stop writes to the table during a
repair migration.

On mysql it wraps the drop and re-add in `withForeignKeyChecksDisabled`, which you can also use directly. The
constraint being recreated was already enforced, so re-validating it only costs a full table scan and can fail on
rows a past import inserted with the checks off:

```typescript
import type { QueryRunner } from 'typeorm';
import { withForeignKeyChecksDisabled } from 'typeorm-extension';

declare const queryRunner: QueryRunner;

await withForeignKeyChecksDisabled(queryRunner, async () => {
    // ... statements which would otherwise trigger a re-validation
});
```

It restores the previous state instead of turning the checks back on, so nesting is safe. On every driver without a
session-level switch it just runs the callback, so a migration using it stays portable.

### Column types

`changeColumnType` builds its own `ALTER COLUMN … TYPE` / `MODIFY COLUMN` statement instead of calling
`queryRunner.changeColumn()`. typeorm drops and re-adds the column as soon as the type or the length differs, on
postgres, cockroachdb, mysql, mariadb, mssql and oracle alike, which discards every value in it. Only sqlite still
goes through typeorm, which is safe there: the table is recreated and the values are copied over.

- On postgres, the values are converted with the assignment cast between the two types. Pass `using` (for example
  `'"roleId"::integer'`) when there is none.
- On mysql, widening a column a foreign key depends on also needs `withForeignKeyChecksDisabled`.
- mariadb refuses to alter either end of a constraint (error 1832/1833), so drop the constraint around the change.

### Driver support

| Helper                         | Drivers                                                                          |
|--------------------------------|----------------------------------------------------------------------------------|
| `renameIndex`                  | `postgres`, `cockroachdb`, `mysql`, `mariadb` (throws a `DriverError` otherwise) |
| `renameForeignKey`             | `postgres`, `cockroachdb`, `mysql`, `mariadb` (throws a `DriverError` otherwise) |
| `changeColumnType`             | all (altered in place on every relational driver but sqlite)                     |
| `withForeignKeyChecksDisabled` | all (only runs the callback outside `mysql` / `mariadb`)                         |

::: warning NOTE
Every helper reads the table with `queryRunner.getTable()` first. For a table with a **generated column**, typeorm
looks the generation expression up in its own `typeorm_metadata` table. On a database where that table does not
exist (one built by something other than typeorm), the call fails with `relation "typeorm_metadata" does not exist`
before the helper does anything.
:::

::: warning NOTE
An index which backs a **constraint** is not reported as an index by the driver, so `renameIndex` does not see it.
On mysql that is the backing index of a foreign key, which only becomes visible once the constraint is dropped:
`renameForeignKey` deals with it for you. On postgres it is a unique constraint, which lives in `table.uniques`.
Renaming a unique constraint is not covered by these helpers: issue the `ALTER TABLE … RENAME CONSTRAINT` yourself
with `queryRunner.query()`.
:::

For every input field, see [renameIndex](./database-api-reference#renameindex),
[renameForeignKey](./database-api-reference#renameforeignkey) and
[changeColumnType](./database-api-reference#changecolumntype).
