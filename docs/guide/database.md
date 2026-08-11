# Database
An alternative to the CLI variant, is to `create` the database in the code base during the runtime of the application.
Therefore, provide the `DataSourceOptions` for the DataSource manually, or let it be created automatically:

## Create
**`Example #1`**
```typescript
import { 
    DataSource, 
    DataSourceOptions
} from 'typeorm';
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


To get a better overview and understanding of the [createDatabase](#createdatabase) function go to the [functions](#functions---database) section and read more about it.

## Drop

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

    // Create the database with specification of the DataSource options
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

To get a better overview and understanding of the [dropDatabase](#dropdatabase) function go to the [functions](#functions---database) section and read more about it.

## Custom Connection

By default, the library opens a raw connection with the driver's native client
(e.g. `pg`, `mysql2`) to run the `CREATE`/`DROP` statements. For server backed drivers,
a caller supplied server-level connection can be injected instead, for example an
existing admin pool or a tunnelled connection. The library never closes an injected
connection; its lifecycle stays with the caller.

```typescript
import { createDatabase } from 'typeorm-extension';
import { pool } from './admin-pool';

(async () => {
    await createDatabase({
        options,
        connection: {
            execute: (statement) => pool.query(statement),
        },
    });
})();
```

The injected object only needs the `execute` part of the `IDatabaseConnection` interface.
It is treated as already open: the library never opens or closes it. For full control
over how connections are opened (e.g. per-database targeting), implement the
`IDatabaseConnectionFactory` interface instead. Both types are exported from the package.

::: warning NOTE
The former per-driver helpers (`createPostgresDatabase`, `dropMySQLDatabase`, ...)
are deprecated and will be removed in the next major release. Use `createDatabase` /
`dropDatabase`; the driver is dispatched automatically from the `type` of the
provided options. For oracle, dropping a database is not supported and the create
statement is passed through unchanged.
:::

## Schema Drift

The database schema and the entity metadata are two independent descriptions of the same thing.
A project which builds its schema with **migrations** in production but with `synchronize()` in tests has no guard
against the two drifting apart, and the failure mode is silent: nothing breaks until someone runs
`migration:generate` and gets a migration full of reconciling statements, potentially including a `DROP COLUMN`
that looks routine in review.

`getSchemaDrift` wraps the same schema comparison `migration:generate` performs and returns the statements which would
reconcile the database schema with the entity metadata. It never writes to the database.

```typescript
import { getSchemaDrift } from 'typeorm-extension';

(async () => {
    const drift = await getSchemaDrift(dataSource);

    if (drift.exists) {
        for (const statement of drift.up) {
            console.log(statement.query);
        }
    }
})();
```

`assertSchemaMatchesMetadata` is the assertion form. It throws a `SchemaDriftError` whose message lists the
statements and whose `statements` property carries them:

```typescript
import { SchemaDriftError, assertSchemaMatchesMetadata } from 'typeorm-extension';

try {
    await assertSchemaMatchesMetadata(dataSource);
} catch (e) {
    if (e instanceof SchemaDriftError) {
        console.log(e.statements);
    }

    throw e;
}
```

Both accept either a `DataSource` or plain `DataSourceOptions`. A data source built from options is built with
`synchronize`, `migrationsRun` and `dropSchema` disabled and destroyed afterwards; an existing `DataSource` is
initialized as is (its own options still apply) and never destroyed.

Use it as a CI gate right after the migrations have run:

```
migration run  ->  revert x N  ->  run  ->  assert zero drift
```

The `skipWithoutMigrations` option reports no drift when the data source has no migrations registered. This is useful when
the same data-source file serves a migration driven environment and a `synchronize()` driven one
(e.g. `migrations: []` for an in-memory sqlite test database):

```typescript
await assertSchemaMatchesMetadata(dataSource, { skipWithoutMigrations: true });
```

The equivalent on the command line is [`typeorm-extension db drift`](./cli#schema-drift).

::: warning NOTE
`mongodb` has no schema to compare; the drift is always reported as empty for it.
:::

## Repair Migrations

Fixing schema drift usually means renaming a constraint, which is dialect-asymmetric and easy to get wrong:

- **postgres** renames in place: `ALTER INDEX … RENAME TO`, `ALTER TABLE … RENAME CONSTRAINT`.
- **mysql** has `ALTER TABLE … RENAME INDEX`, but no `RENAME CONSTRAINT`: a foreign key must be dropped and re-added,
  and if its column carried no explicit index, mysql created a backing index **under the constraint name** which
  survives the drop and has to be dealt with before the new constraint is added.

The following helpers own that machinery. The data (which constraint is renamed to what) stays in your migration.

Each helper is **guarded**: it reads the current state back from the database, applies the change only if it is still
pending and returns whether it did something. A repair migration therefore stays resumable (mysql commits DDL
regardless of the surrounding transaction) and is safe to run against a database which never had the drift.

A guard only covers the state the change would produce. If the database is in **neither** the expected nor the desired
state (a mistyped constraint name, a column which is not the type the migration believes it is), the helper raises a
`SchemaAlterationError` instead of returning quietly, because a repair migration which repairs nothing is otherwise
indistinguishable from a successful one. Pass `strict: false` to get the silent no-op back:

```typescript
await renameIndex(queryRunner, {
    table: 'auth_events',
    from: 'IDX_auth_events_actor_name',
    to: 'IDX_9f6d1a2b3c4d5e6f70819293',
    // this database may never have had the index at all
    strict: false,
});
```

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
        });

        await changeColumnType(queryRunner, {
            table: 'auth_permissions',
            column: 'client_id',
            from: { type: 'varchar', length: 36 },
            to: { type: 'varchar', length: 255 },
        });
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ... the same calls with from & to swapped
    }
}
```

`renameForeignKey` preserves the columns, the referenced table/columns and the referential actions of the constraint.
All of them are read back from the database, so the rename can not silently change the constraint.

There is one state it can not read them back from: on mysql the `DROP` and the `ADD` are separate, auto-committed
statements, so a run interrupted between them leaves neither the old nor the new constraint behind. Pass `meta` along to
make that recoverable; it is only consulted when neither name is present:

```typescript
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

On mysql it wraps the drop & re-add in `withForeignKeyChecksDisabled`, which you can also use directly. The constraint
being recreated was already enforcing, so re-validating it only buys a full table scan plus a failure mode for rows some
past import inserted with the checks off:

```typescript
import { withForeignKeyChecksDisabled } from 'typeorm-extension';

await withForeignKeyChecksDisabled(queryRunner, async () => {
    // ... statements which would otherwise trigger a re-validation
});
```

It restores the previous state rather than blindly enabling the checks, so nesting is safe, and it is a transparent
no-op wrapper on every driver without a session level switch, so a migration using it stays portable.

### Driver support

| Helper                         | Drivers                                                                         |
|--------------------------------|---------------------------------------------------------------------------------|
| `renameIndex`                  | `postgres`, `cockroachdb`, `mysql`, `mariadb` (throws a `DriverError` otherwise) |
| `renameForeignKey`             | `postgres`, `cockroachdb`, `mysql`, `mariadb` (throws a `DriverError` otherwise) |
| `changeColumnType`             | all (altered in place on every relational driver but sqlite)                    |
| `withForeignKeyChecksDisabled` | all (a no-op wrapper outside of `mysql` / `mariadb`)                            |

::: warning NOTE
`changeColumnType` builds its own statement rather than delegating to `queryRunner.changeColumn()`, because typeorm
drops and re-adds the column *"to avoid data conversion"* as soon as the type or the length differs. That happens on
postgres, cockroachdb, mysql, mariadb, mssql and oracle alike. On a populated table that silently discards every value in the
column, so the helper emits `ALTER COLUMN … TYPE` / `MODIFY COLUMN` instead.

Only sqlite still goes through typeorm, which is safe there: the table is recreated and the values are copied over.

On mysql, widening a column a foreign key depends on additionally needs
[`withForeignKeyChecksDisabled`](./database-api-reference#withforeignkeychecksdisabled); mariadb refuses to alter either end of a constraint
outright (error 1832/1833), so the constraint has to be dropped around the change there.
:::

::: warning NOTE
Every helper reads the table back with `queryRunner.getTable()` first. For a table which contains a **generated
column**, typeorm looks the generation expression up in its own `typeorm_metadata` table. On a database where that
table does not exist (one built by something other than typeorm), the call fails with `relation "typeorm_metadata" does
not exist` before the helper does anything.
:::

::: warning NOTE
An index which backs a **constraint** is not reported as an index by the driver, and `renameIndex` therefore does not
see it.

On mysql that is the backing index of a foreign key, which only becomes visible once the constraint is dropped;
`renameForeignKey` deals with it for you. On postgres it is a unique constraint, which lives in `table.uniques`.
Renaming a unique constraint is **not** covered by these helpers: `renameForeignKey` only handles foreign keys, so
issue the `ALTER TABLE … RENAME CONSTRAINT` yourself via `queryRunner.query()`.
:::
