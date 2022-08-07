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

If the function is **not** called within the ts-node runtime environment, the source path `src/database/entities.ts` for example,
will be rewritten to `dist/database/entities.js`.

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
import { createDatabase } from 'typeorm-extension';

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
