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
destroyed afterwards. An existing `DataSource` is initialized as is — its own options still apply — and never destroyed.

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

## `renameIndex`

Rename an index. A no-op (returning `false`) if the table does not exist, an index is already named `to`,
or no index is named `from`.

```typescript
declare function renameIndex(
    queryRunner: QueryRunner,
    input: SchemaRenameIndexInput,
): Promise<boolean>;
```

Supported for `postgres`, `cockroachdb`, `mysql` and `mariadb`; throws a `DriverError` for any other driver.

An index which backs a constraint is not reported as an index by the driver and is therefore not seen by this function —
on postgres a unique constraint lives in `table.uniques`, and on mysql a foreign key's backing index only becomes
visible once the constraint is dropped (which [renameForeignKey](#renameforeignkey) handles).

## `renameForeignKey`

Rename a foreign key constraint, preserving its columns, its referenced table/columns and its referential actions —
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

A no-op (returning `false`) if the table does not exist, a constraint is already named `to`, or no constraint is
named `from`. Supported for `postgres`, `cockroachdb`, `mysql` and `mariadb`; throws a `DriverError` otherwise.

## `changeColumnType`

Change the type (and optionally the nullability) of a column, but only if it still matches the `from` description.

```typescript
declare function changeColumnType(
    queryRunner: QueryRunner,
    input: SchemaChangeColumnTypeInput,
): Promise<boolean>;
```

A no-op (returning `false`) if the table/column does not exist, the column already matches `to`, or it matches neither.
Works on every driver, since the statements are built by typeorm itself.

## `withForeignKeyChecksDisabled`

Run a callback with the mysql/mariadb foreign key checks disabled and restore the previous state afterwards.

```typescript
declare function withForeignKeyChecksDisabled<T>(
    queryRunner: QueryRunner,
    fn: () => Promise<T>,
): Promise<T>;
```

It reads `@@SESSION.foreign_key_checks` first and only restores it if it was enabled, so nesting is safe. On a driver
without a session level switch it is a transparent no-op wrapper, which keeps a migration using it portable.

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
export type SchemaRenameForeignKeyInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    from: string,
    to: string
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

**References**
- [DatabaseBaseContext](#databasebasecontext)
