# Database

## `createDatabase`

**Type**
```ts
declare function createDatabase(
    context?: DatabaseCreateContext
): Promise<string>;
```

Create a database.

**Example: Simple**
```typescript
// Only create database if it does not exist.
await createDatabase({ ifNotExist: true });
```

**Example: Synchronization**
```typescript
// To not synchronize database schema after database creation.
await createDatabase({ synchronize: false });
```

**Example: Charset**

It is possible to explizit specify `charset` & `characterSet`, besides defining it as part of the `DataSourceOptions` object.
E.g.
- postgres
  ```typescript
   await createDatabase({ characterSet: "UTF8" });
  ```
- mysql
  ```typescript
  await createDatabase({ charset: "utf8mb4_general_ci", characterSet: "utf8mb4" });
  ```

**Example: DataSourceOptions**

The typeorm DataSourceOptions object can be provided as `options` property to the createDatabase method.

```typescript
import { DataSourceOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

(async () => {
 const options : DataSourceOptions = {
    //...
 };
 // Create database
 await createDatabase({
    options
 });
})();
```

if `entities` & `subscribers` are defined as path, it is possible to use them with e.g. ts-node as well as with the compiled version.
Therefore, extend the DataSourceOptions with the `extendDataSourceOptions` utility method.

```typescript
import { DataSourceOptions } from 'typeorm';
import { createDatabase, extendDataSourceOptions } from 'typeorm-extension';

(async () => {
 let options : DataSourceOptions = {
     // ...
 }

 options = await extendDataSourceOptions(options);

 // Create database
 await createDatabase({
    options
 });
})();
```
This is achieved by rewriting the `src` path and `.ts` extension, to the `dist` (outDir) path and `.js` extension.

If the function is **not** called within a just-in-time runtime environment (`ts-node` and `tsx` are detected automatically),
the source path `src/database/entities.ts` for example, will be rewritten to `dist/database/entities.js`.

**Parameters**

| Name      | Type                    | Description                                                                         |
|:----------|:------------------------|:------------------------------------------------------------------------------------|
| `context` | `DatabaseCreateContext` | Specify charset, coalition and DataSourceOptions. [Details](#databasecreatecontext) |

**Returns**

`Promise`<`unknown`>

The function returns a promise with the query result of the underlying database driver.

**References**
- [DatabaseCreateContext](#databasecreatecontext)

## `dropDatabase`

```ts
declare function dropDatabase(
    context?: DatabaseDropContext
): Promise<unknown>;
```

Drop a database.

**Example: Simple**
```typescript
import { dropDatabase } from 'typeorm-extension';

(async () => {
    await dropDatabase();
})();
```

**Example: DataSourceOptions**

The typeorm DataSourceOptions object can be provided as `options` property to the dropDatabase method.

```typescript
import { DataSourceOptions } from 'typeorm';
import { dropDatabase } from 'typeorm-extension';

(async () => {
    const options : DataSourceOptions = {
        //...
    };
    // Drop database
    await dropDatabase({
        options
    });
})();
```

**Parameters**

| Name      | Type                  | Description                                                                       |
|:----------|:----------------------|:----------------------------------------------------------------------------------|
| `context` | `DatabaseDropContext` | Specify charset, coalition and DataSourceOptions. [Details](#databasedropcontext) |

**Returns**

`Promise`<`unknown`>

The function returns a promise with the query result of the underlying database driver.

**References**
- [DatabaseDropContext](#databasedropcontext)

## `getSchemaDrift`

Compare the database schema against the entity metadata and return the statements which would reconcile them.
The inspection never writes to the database.

```typescript
declare function getSchemaDrift(
    input: DataSource | DataSourceOptions,
    options?: SchemaDriftOptions,
): Promise<SchemaDrift>;
```

**Example**
```typescript
import { getSchemaDrift } from 'typeorm-extension';

const drift = await getSchemaDrift(dataSource);
if (drift.exists) {
    console.log(drift.up.map((statement) => statement.query));
}
```

A data source built from the passed options is built with `synchronize`, `migrationsRun` and `dropSchema` disabled and
destroyed afterwards. An existing `DataSource` is initialized as is (its own options still apply) and never destroyed.

**References**
- [SchemaDrift](#schemadrift)
- [SchemaDriftOptions](#schemadriftoptions)

## `assertSchemaMatchesMetadata`

The assertion form of [getSchemaDrift](#getschemadrift).

```typescript
declare function assertSchemaMatchesMetadata(
    input: DataSource | DataSourceOptions,
    options?: SchemaDriftOptions,
): Promise<void>;
```

Throws a `SchemaDriftError` whose message lists the reconciling statements and whose `statements` property carries them.

## `generateMigration`

Generate a migration file from the difference between the database schema and the entity metadata, using the same
comparison and the same file templates as `typeorm migration:generate`.

```typescript
declare function generateMigration(
    context: MigrationGenerateCommandContext,
): Promise<MigrationGenerateResult>;
```

**Example**
```typescript
import { generateMigration } from 'typeorm-extension';

await generateMigration({
    dataSource,
    name: 'add-role',
    directoryPath: 'src/migrations',
});
```

The data source must already be initialized, and it is not destroyed afterwards. The file is written as
`<timestamp>-<name>.<language>` inside `directoryPath` (`migrations/` relative to the working directory by default).
When there is nothing to generate, no file is written and `content` is undefined. Pass `preview: true` to receive the
statements without touching the file system.

**References**
- [MigrationGenerateCommandContext](#migrationgeneratecommandcontext)
- [MigrationGenerateResult](#migrationgenerateresult)

## `renameIndex`

Rename an index. Returns `false` when an index is already named `to`. When neither name exists (or the table does not exist),
a `SchemaAlterationError` is raised unless `strict: false` is passed.

```typescript
declare function renameIndex(
    queryRunner: QueryRunner,
    input: SchemaRenameIndexInput,
): Promise<boolean>;
```

Supported for `postgres`, `cockroachdb`, `mysql` and `mariadb`; throws a `DriverError` for any other driver.

An index which backs a constraint is not reported as an index by the driver and is therefore not seen by this function.
On mysql that is a foreign key's backing index, which only becomes visible once the constraint is dropped; it is handled
for you by [renameForeignKey](#renameforeignkey). On postgres it is a unique constraint, which lives in `table.uniques`:
renaming one is **not** covered by these helpers and needs a raw `ALTER TABLE … RENAME CONSTRAINT`.

## `renameForeignKey`

Rename a foreign key constraint, preserving its columns, its referenced table/columns and its referential actions,
all of which are read back from the database.

```typescript
declare function renameForeignKey(
    queryRunner: QueryRunner,
    input: SchemaRenameForeignKeyInput,
): Promise<boolean>;
```

postgres renames the constraint in place. mysql has no `RENAME CONSTRAINT`, so the constraint is dropped and re-added
inside [withForeignKeyChecksDisabled](#withforeignkeychecksdisabled), and the backing index mysql may have created under
the constraint name is renamed (or dropped, if the target name is already taken) in between.

Returns `false` when a constraint is already named `to`. When neither name exists and no `meta` describes the
constraint (or the table does not exist), a `SchemaAlterationError` is raised unless `strict: false` is passed.
Supported for `postgres`, `cockroachdb`, `mysql` and `mariadb`; throws a `DriverError` otherwise.

If **neither** name exists (what a mysql run interrupted between the drop and the re-add leaves behind, where the
constraint took its own description with it), the optional `meta` is used to restore it:

```typescript
await renameForeignKey(queryRunner, {
    table: 'auth_permissions',
    from: 'FK_old',
    to: 'FK_new',

    // only consulted when neither FK_old nor FK_new is present
    meta: {
        columns: ['client_id'],
        referencedTable: 'auth_clients',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
    },
});
```

While `from` still exists `meta` is ignored and the description is read from the database instead, so the normal path
can not silently change the constraint. Without `meta` the interrupted state stays a no-op.

## `changeColumnType`

Change the type (and optionally the nullability) of a column, but only if it still matches the `from` description.

```typescript
declare function changeColumnType(
    queryRunner: QueryRunner,
    input: SchemaChangeColumnTypeInput,
): Promise<boolean>;
```

Returns `false` when the column already matches `to`. When it matches neither description (or the table/column does
not exist), a `SchemaAlterationError` is raised unless `strict: false` is passed.

The column is altered **in place**, so it keeps the values it holds: `ALTER COLUMN … TYPE` on postgres/cockroachdb,
`MODIFY COLUMN` on mysql/mariadb, `ALTER COLUMN` on mssql and `MODIFY` on oracle. That is the reason the statement is
built here: typeorm's `changeColumn` drops and re-adds the column as soon as the type or the length differs, which
empties it (and fails outright once the table holds a row it can not re-add as `NOT NULL`). Only sqlite still goes
through typeorm, which recreates the table and copies the values over.

Since mysql replaces the column definition in full, every attribute of the column (default, comment, charset,
collation, `UNSIGNED`, `AUTO_INCREMENT`, `ON UPDATE`, the values of an `enum`) is restated from the description the
database reports back, not from the passed input.

postgres converts the values with the assignment cast between the two types and refuses a change which has none
(`text` to `integer`, for example). Pass `using` (raw SQL computing the new value from the old one) for those:

```typescript
await changeColumnType(queryRunner, {
    table: 'auth_permissions',
    column: 'client_id',
    from: { type: 'varchar', length: 36 },
    to: { type: 'uuid' },
    using: '"client_id"::uuid',
});
```

`using` is postgres/cockroachdb only. On any other dialect it raises a `DriverError` rather than being dropped, since
ignoring it would leave the server to coerce the values on its own terms, which is what passing it was meant to avoid.

Two mysql caveats follow from that:

- A **generated column** can only be restated together with its expression, which typeorm reads from its own
  `typeorm_metadata` table. When that row is missing the expression comes back empty, and the helper throws a
  `DriverError` instead of altering the column into a regular one.
- `ZEROFILL` is **not** preserved: typeorm does not read it into `TableColumn` at all, so there is nothing to restate.
  It is a display attribute mysql deprecated in 8.0.17, and typeorm's own statements drop it just the same.

## Guard semantics

Every guarded helper takes `strict` (default `true`):

| Database state | `strict: true` (default) | `strict: false` |
|:---------------|:-------------------------|:----------------|
| Change is pending | applies it, returns `true` | applies it, returns `true` |
| Already in the desired state | returns `false` | returns `false` |
| In neither state (wrong name, wrong type, missing table/column) | throws `SchemaAlterationError` | returns `false` |

Being already in the desired state is never an error; that is what keeps a repair migration resumable. The strict mode
only covers the third row, where the migration's description of the database is wrong and returning `false` would let a
repair which never happened pass for a successful one.

::: warning NOTE
Every helper reads the table back with `queryRunner.getTable()`. For a table containing a **generated column** typeorm
resolves the generation expression from its own `typeorm_metadata` table, so on a database where that table is absent
the call fails with `relation "typeorm_metadata" does not exist` before the helper does anything.
:::

## `withForeignKeyChecksDisabled`

Run a callback with the mysql/mariadb foreign key checks disabled and restore the previous state afterwards.

```typescript
declare function withForeignKeyChecksDisabled<T>(
    queryRunner: QueryRunner,
    fn: () => Promise<T>,
): Promise<T>;
```

It reads `@@SESSION.foreign_key_checks` first and only restores it if it was enabled, so nesting is safe. On a driver
without a session-level switch it is a transparent no-op wrapper, which keeps a migration using it portable.

## SchemaDrift
```typescript
export type SchemaDriftStatement = {
    query: string,
    parameters?: unknown[]
};

export type SchemaDrift = {
    /**
     * Whether the database schema deviates from the entity metadata.
     */
    exists: boolean,
    up: SchemaDriftStatement[],
    down: SchemaDriftStatement[]
};
```

## SchemaDriftOptions
```typescript
export type SchemaDriftOptions = {
    /**
     * Report no drift if the data source has no migrations registered.
     *
     * default: false
     */
    skipWithoutMigrations?: boolean
};
```

## SchemaRenameIndexInput
```typescript
export type SchemaRenameIndexInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    from: string,
    to: string
};
```

## SchemaRenameForeignKeyInput
```typescript
export type SchemaForeignKeyMeta = {
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    onDelete?: string,
    onUpdate?: string
};

export type SchemaRenameForeignKeyInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    from: string,
    to: string,
    /**
     * Only consulted when neither `from` nor `to` exists.
     */
    meta?: SchemaForeignKeyMeta
};
```

## SchemaChangeColumnTypeInput
```typescript
export type SchemaColumnType = {
    type: string,
    length?: string | number,
    /**
     * Only compared/applied if defined.
     */
    nullable?: boolean
};

export type SchemaChangeColumnTypeInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    column: string,
    /**
     * The column type expected to be present. The helper is a no-op if the
     * column does not match it (e.g. because it is already migrated).
     */
    from: SchemaColumnType,
    to: SchemaColumnType
};
```

## DatabaseBaseContext
```typescript
import { DataSourceOptions } from 'typeorm';
import { DataSourceFindOptions } from 'typeorm-extension';

export type DatabaseBaseContext = {
    /**
     * Options for finding the typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,

    /**
     * Options for the find method, where to look for the data-source file.
     */
    findOptions?: DataSourceFindOptions
};
```

**References**
- [DataSourceFindOptions](datasource-api-reference.md#datasourcefindoptions)

## DatabaseCreateContext
```typescript
import { DatabaseBaseContext } from 'typeorm-extension';

export type DatabaseCreateContext = DatabaseBaseContext & {
    /**
     * Only create database if not already exist.
     *
     * default: true
     */
    ifNotExist?: boolean,
    /**
     * Initial database to connect.
     *
     * default: undefined
     */
    initialDatabase?: string,
    /**
     * Synchronize database entities.
     *
     * default: true
     */
    synchronize?: boolean
};
```

`createDatabase()` accepts `DatabaseCreateContextInput`: this type with every property optional, plus `findOptions`.
The resolved context passed on to the driver no longer carries `findOptions`, because it is consumed while the data source is discovered.

**References**
- [DatabaseBaseContext](#databasebasecontext)

## DatabaseDropContext

```typescript
import { DatabaseBaseContext } from 'typeorm-extension';

export type DatabaseDropContext = DatabaseBaseContext & {
    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};
```

`dropDatabase()` accepts `DatabaseDropContextInput`, which follows the same rule as the create variant above.

**References**
- [DatabaseBaseContext](#databasebasecontext)

## MigrationGenerateCommandContext

```typescript
import { DataSource } from 'typeorm';

export type MigrationGenerateCommandContext = {
    /**
     * Directory where the migration(s) should be stored.
     *
     * Default: 'migrations'
     */
    directoryPath?: string,

    /**
     * Name of the migration class.
     *
     * Default: 'Default'
     */
    name?: string,

    /**
     * DataSource used for reference of existing schema.
     */
    dataSource: DataSource,

    /**
     * Timestamp in milliseconds.
     *
     * Default: Date.now()
     */
    timestamp?: number,

    /**
     * Prettify sql statements.
     *
     * Default: false
     */
    prettify?: boolean,

    /**
     * Language of the generated migration file. It also determines the file extension.
     *
     * Default: 'ts'
     */
    language?: 'ts' | 'js',

    /**
     * Generate an ESM (export class) instead of a CommonJS (module.exports) migration.
     * Only applies to the language js.
     *
     * Default: false
     */
    esm?: boolean,

    /**
     * Only return up- & down-statements instead of backing up the migration to the file system.
     *
     * Default: false
     */
    preview?: boolean
};
```

## MigrationGenerateResult

```typescript
export type MigrationGenerateResult = {
    /**
     * Statements which bring the database schema in line with the entity metadata.
     */
    up: string[],

    /**
     * Statements which undo the up statements, in reverse order.
     */
    down: string[],

    /**
     * Content of the migration file. Undefined if there is nothing to generate.
     */
    content?: string
};
```
