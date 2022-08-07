# DataSource

## `setDataSource`

```typescript
declare function setDataSourceOptions(
    dataSource: DataSource,
    alias?: string
) : void;
```

Set the default DataSource, by not providing any alias at all or using the key `default`.
This method should only be used, if an additional DataSource should be registered or the library should
not attempt to instantiate the instance on the fly.

**Example: Single**
```typescript
import { setDataSource } from 'typeorm-extension';
import { DataSource, DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

const dataSource = new DataSource(options);
setDataSource(dataSource);
```

**Example: Multiple**
```typescript
import { setDataSource } from 'typeorm-extension';
import { DataSource, DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

const dataSource = new DataSource(options);
setDataSource(dataSource, 'foo');
```

**Parameters**

| Name         | Type                    | Description                                                              |
|:-------------|:------------------------|:-------------------------------------------------------------------------|
| `dataSource` | `DataSource`            | Typeorm DataSource instance.                                             |
| `alias`      | `string` or `undefined` | Alias for depositing the typeorm DataSource instance. Default: `default` |

**Returns**

`void`

## `useDataSource`

```typescript
declare function useDataSource(
    alias?: string
) : Promise<DataSource>;
```

Use the default deposited DataSource, by not providing any alias at all or using the key `default`.
If no DataSource instance or DataSourceOptions object is deposited initially, the method will attempt
to locate, load & initialize the DataSource.

**Example: Auto**
```typescript
import { useDataSource } from 'typeorm-extension';

(async () => {
    // Load the deposited DataSource,
    // otherwise instanitate the instance from the deposited DataSourceOptions object
    const options = await useDataSource();
})();
```

**Example: Single**
```typescript
import { setDataSource, useDataSource } from 'typeorm-extension';
import { DataSource, DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

const dataSource = new DataSource(options);
setDataSource(dataSource);

(async () => {
    // now the method can use the deposited configuration.
    const instance = await useDataSource();
})();
```

**Example: Multiple**
```typescript
import { setDataSource, useDataSource } from 'typeorm-extension';
import { DataSource, DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

const dataSource = new DataSource(options);
setDataSource(dataSource, 'foo');

(async () => {
    // now the method can use the deposited configuration.
    const instance = await useDataSource('foo');
})();
```

**Parameters**

| Name      | Type                    | Description                                                             |
|:----------|:------------------------|:------------------------------------------------------------------------|
| `alias`   | `string` or `undefined` | Alias for receiving the typeorm DataSource instance. Default: `default` |

**Returns**

`Promise`<`DataSource`>

## `setDataSourceOptions`

```typescript
declare function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string
) : void;
```

Set the default DataSourceOptions object, by not providing any alias at all or using the key `default`.
The DataSource instance will be created from this configuration, if it has not already been created before.

**Example: Single**
```typescript
import { setDataSourceOptions, useDataSource } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

setDataSourceOptions(options);
```

**Example: Multiple**
```typescript
import { setDataSourceOptions, useDataSource } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

setDataSourceOptions(options, 'foo');
```

**Parameters**

| Name      | Type                    | Description                                                         |
|:----------|:------------------------|:--------------------------------------------------------------------|
| `options` | `DataSourceOptions`     | Typeorm DataSourceOptions object.                                   |
| `alias`   | `string` or `undefined` | Alias for depositing the typeorm options object. Default: `default` |

**Returns**

`void`

## `useDataSourceOptions` 

```typescript
declare function useDataSourceOptions(
    alias?: string
) : Promise<DataSourceOptions>;
```

Use the default deposited DataSourceOptions object, by not providing any alias at all or using the key `default`.
If no DataSourceOptions object is deposited initially the method will attempt to locate and load the DataSource file
and extract the options from there.

Therefore, it will search for a `data-source.{ts,js}` file in the following directories:

- `{src,dist}/db/`
- `{src,dist}/database`
- `{src,dist}`

**Example: Auto**
```typescript
import { useDataSourceOptions } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';

(async () => {
    // load the deposited options otherwise the library
    // will attempt to locate and load the data-source file and
    // extract the options from there
    const options = await useDataSourceOptions();
})();
```

**Example: Single**
```typescript
import { setDataSourceOptions, useDataSource } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

setDataSourceOptions(options);

(async () => {
    // now the method can use the deposited configuration.
    const options = await useDataSourceOptions();
})();
```

**Example: Multiple**
```typescript
import { setDataSourceOptions, useDataSource } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';

const options: DataSourceOptions = {
    // ...
}

setDataSourceOptions(options, 'foo');

(async () => {
    // now the method can use the deposited configuration.
    const options = await useDataSourceOptions('foo');
})();
```

**Parameters**

| Name      | Type                    | Description                       |
|:----------|:------------------------|:----------------------------------|
| `alias`   | `string` or `undefined` | Typeorm DataSourceOptions object. |

**Returns**

`Promise`<`DataSourceOptions`>


## `buildDataSourceOptions`

```typescript
declare async function buildDataSourceOptions(
    context?: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions>
```

**Parameters**

| Name      | Type                                  | Description                            |
|:----------|:--------------------------------------|:---------------------------------------|
| `context` | `DataSourceOptionsBuildContext`       | Context for building DataSourceOptions |

**Returns**

`Promise`<`DataSourceOptions`>

**References**
- [DataSourceOptionsBuildContext](#datasourceoptionsbuildcontext)

## `extendDataSourceOptions`

```typescript
declare async function extendDataSourceOptions(
    options: DataSourceOptions,
    tsConfigDirectory?: string,
) : Promise<DataSourceOptions>;
```

**Parameters**

| Name                | Type                        | Description                                                        |
|:--------------------|:----------------------------|:-------------------------------------------------------------------|
| `options`           | `DataSourceOptions`         | Alias for receiving the typeorm options object. Default: `default` |
| `tsConfigDirectory` | `string` or `undefined`     | Directory path of tsconfig.json. Default: `process.cwd()`          |

**Returns**

`Promise`<`DataSourceOptions`>

## `DataSourceFindOptions`

```typescript
export type DataSourceFindOptions = {
    directory?: string,
    fileName?: string
};
```

## `DataSourceOptionsBuildContext`

```typescript
export type DataSourceOptionsBuildContext = {
    /**
     * Database connection name
     * Default: default
     *
     * @deprecated
     */
    name?: string,
    /**
     * Configuration file name without extension
     * Default: ormconfig
     *
     * @deprecated
     */
    configName?: string,
    /**
     * Data source file name without extension
     * Default: data-source
     */
    dataSourceName?: string,
    /**
     * Directory where to find dataSource + config
     * Default: process.cwd()
     */
    directory?: string,
    /**
     * Directory path to the tsconfig.json file
     * Default: process.cwd()
     */
    tsconfigDirectory?: string
};
```
