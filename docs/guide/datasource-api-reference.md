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

## `withDataSourceTimezone`

```typescript
declare function withDataSourceTimezone<T extends DataSourceOptions>(
    options: T,
    timezone: 'UTC',
) : T
```

Pin a data source to UTC on **every** side of a zone-less date column
(`timestamp without time zone`, `datetime`, `TIMESTAMP`): the database session
that stamps it (`now()`, `CURRENT_TIMESTAMP`), and the driver that writes a
`Date` parameter into it and reads it back.

Left alone, the database stamps such a column in its own session timezone,
while the driver reads and writes it in the timezone of the Node process. They
agree only while both clocks do. A database running in local time, or an
application host that is not UTC, then shifts every `@CreateDateColumn` /
`@UpdateDateColumn` by the offset, and a value the application writes can land
in a different zone than one the database stamps.

| Driver              | What is applied                                                                                   |
|:--------------------|:--------------------------------------------------------------------------------------------------|
| `postgres`          | `-c TimeZone=UTC` as a startup option (`extra.options`); a pool type parser (`extra.types`) reading `timestamp without time zone` as UTC, with `infinity` and BC dates intact; a pool client (`extra.Client`, built on `pg-native` when typeorm uses it) sending `Date` parameters as UTC. |
| `mysql`, `mariadb`  | `timezone: 'Z'` for mysql2 (reading and parameters), and pools running `SET time_zone = '+00:00'` on every new connection before it is used. |
| `oracle`            | a pool `sessionCallback` running `ALTER SESSION SET TIME_ZONE = '+00:00'`; connections reading a zone-less `TIMESTAMP` as UTC and binding `Date` parameters as `TIMESTAMP WITH TIME ZONE`. |
| `cockroachdb`       | nothing: typeorm maps date columns to `timestamptz`, which carries its zone.                         |
| `better-sqlite3`    | nothing: `datetime('now')` stamps UTC and typeorm reads and writes the column as UTC.               |
| `mongodb`           | nothing: BSON dates are UTC.                                                                        |
| `mssql`             | nothing, see below.                                                                                 |

It is **all or nothing** per driver: half a pin shifts values instead of fixing
them. So anything already set on either side returns the options unchanged: a
mysql `timezone`; a postgres `TimeZone` in `extra.options`, `extra.types` or
`extra.Client`; an oracle `extra.sessionCallback`. That is also what makes the
call idempotent. A mysql replication setup has no per-connection hook and is
returned unchanged too. A given `driver` is wrapped instead of the one typeorm
loads.

Only UTC is supported: a zone-less value can be read as UTC with a marker,
while any other zone needs the offset in force at that instant.

Two limits remain:

- **mssql** cannot be pinned through the options: typeorm stamps with
  `getdate()`, the local time of the server's operating system, and SQL Server
  has no session timezone to set. The driver reads `datetime2` as UTC
  (`useUTC`, on by default), so values are right only on a server running in
  UTC. Otherwise declare the default yourself, e.g.
  `@CreateDateColumn({ default: () => 'SYSUTCDATETIME()' })`.
- **oracle** hands a zone-less `TIMESTAMP` over as a local `Date`, with no
  option to change that, so the pin re-reads its fields as UTC. That is exact
  in a process running in UTC. In a zone with daylight saving, a value whose
  fields fall into the local spring-forward hour arrives an hour late.

::: warning
Only new rows are affected. A database that ran in another zone keeps the
wall-clock values it stamped before, and those now read as UTC. Convert them
once if they matter.
:::

The same can be requested through the environment, for options read from it
and for options merged with it (`buildDataSourceOptions`):

```bash
DB_TIMEZONE=UTC  # or TYPEORM_TIMEZONE
```

Any other value throws an `OptionsError`.

**Parameters**

| Name       | Type                | Description                       |
|:-----------|:--------------------|:----------------------------------|
| `options`  | `DataSourceOptions` | The options to pin.               |
| `timezone` | `'UTC'`             | The timezone to pin both sides to. |

**Returns**

`DataSourceOptions`: a new object when anything was applied, otherwise the
input itself (a driver needing nothing, a mysql replication setup, a setting
already present). The input is never modified.

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
    tsconfig?: string | TSConfig,

    /**
     * This option indicates if file paths should be preserved,
     * and treated as if the just-in-time compilation environment is detected.
     */
    preserveFilePaths?: boolean
};
```
