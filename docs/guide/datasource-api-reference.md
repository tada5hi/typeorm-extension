# DataSource

## `setDataSource`

```typescript
declare function setDataSource(
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

## `findDataSource`

```typescript
declare async function findDataSource(
    context?: DataSourceFindOptions,
) : Promise<DataSource | undefined>
```

Locates the data source file (see [Discovery](./data-source#discovery)) and returns the `DataSource` it exports. An
export may be a `DataSource`, a promise of one, a default export function without parameters returning one (sync or
async), or a `DataSourceOptions` object, which is wrapped in a new `DataSource`. Named exports are never called. Within one file they are tried in that order. The
returned instance is not initialized by the library.

**Parameters**

| Name      | Type                    | Description                         |
|:----------|:------------------------|:------------------------------------|
| `context` | `DataSourceFindOptions` | Where and under which name to look. |

**Returns**

`Promise`<`DataSource` | `undefined`>: `undefined` when no file has an accepted export.

**References**
- [DataSourceFindOptions](#datasourcefindoptions)
- [Accepted export shapes](./data-source#accepted-export-shapes)

## `findDataSourceOptions`

```typescript
declare async function findDataSourceOptions(
    context?: DataSourceFindOptions,
) : Promise<DataSourceOptions | undefined>
```

Runs the same lookup as [`findDataSource`](#finddatasource), but returns only the options. An exported
`DataSourceOptions` object is returned as it is: no `DataSource` is constructed, so the driver package is not loaded.
`buildDataSourceOptions()` uses it, which keeps an environment that names another driver usable when the file's
driver package is not installed.

**Parameters**

| Name      | Type                    | Description                         |
|:----------|:------------------------|:------------------------------------|
| `context` | `DataSourceFindOptions` | Where and under which name to look. |

**Returns**

`Promise`<`DataSourceOptions` | `undefined`>: `undefined` when no file has an accepted export.

## `hasEnvDataSourceOptions`

```typescript
declare function hasEnvDataSourceOptions(options?: { strict?: boolean }): boolean;
```

True when the environment names a driver: `DB_TYPE` (or `TYPEORM_CONNECTION`), or a `DB_URL` whose scheme names it
(`postgres://...`). A `DB_URL` without a scheme names no driver. Only then are data source options read from the
environment.

With `strict: true` it is only true when the environment describes a data source completely: a driver and at least one
connection setting (`DB_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` or `DB_SID`, or one of
their `TYPEORM_*` aliases).

An incomplete environment gives `false`, never an error (`assertEnvDataSourceOptions` tells why it is refused). A
malformed `DB_DRIVER_EXTRA` still fails, as everywhere the environment is read. An empty value counts as unset, and it
checks the values data source options are built from, so it always agrees with what `buildDataSourceOptions` reads.

## `assertEnvDataSourceOptions`

```typescript
declare function assertEnvDataSourceOptions(options?: { required?: boolean }): void;
```

Refuses an environment which sets connection settings (`DB_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
`DB_DATABASE`, `DB_SID`, or a `TYPEORM_*` alias) but names no driver. Data source options are not read from such an
environment, so the settings would otherwise be ignored without a word, and a default driver (e.g. sqlite) used instead.

With `required: true` it also refuses an environment which names no driver at all, e.g. to require the database
configuration in production:

```typescript
import { assertEnvDataSourceOptions } from 'typeorm-extension';

assertEnvDataSourceOptions({ required: process.env.NODE_ENV === 'production' });
```

**Throws**

- `OptionsError` naming the variables which are set when the driver is missing.
- `OptionsError` when `required` is set and the environment names no driver.

## `pinTimezone`

```typescript
declare function pinTimezone<T extends DataSourceOptions>(
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

```typescript
// data-source.ts
import { DataSource } from 'typeorm';
import { pinTimezone } from 'typeorm-extension';

export const dataSource = new DataSource(pinTimezone({
    type: 'postgres',
    // ...
}, 'UTC'));
```

| Driver              | What is applied                                                                                   |
|:--------------------|:--------------------------------------------------------------------------------------------------|
| `postgres`          | `-c TimeZone=UTC` for the session, added to the startup options pg would use (the connection url's `options`, else `extra.options`, else `PGOPTIONS`), which are moved into `extra.options`; parsers reading `timestamp without time zone` and `timestamp[]` as UTC; a pool client sending `Date` parameters as UTC, streams included. |
| `mysql`, `mariadb`  | `timezone: 'Z'` (reading and parameters), `dateStrings: ['DATE']` (a calendar date stays the string it was), and pools running `SET time_zone = '+00:00'` on every new connection before it is used. A `replication` setup is pinned on every node: the pool cluster runs the `SET` on each session before handing it out. With `extra.resetOnRelease`, the `SET` runs again after every reset, since the reset puts the session zone back to the server default. |
| `oracle`            | a pool `sessionCallback` running `ALTER SESSION SET TIME_ZONE = '+00:00'` (a standalone `getConnection` runs it before handing the connection out); connections reading a zone-less `TIMESTAMP` (result columns and `RETURNING` out-binds) as UTC, and binding `Date` parameters (untyped or `TIMESTAMP`, `executeMany` following its `bindDefs`) as their UTC wall clock with the plain `TIMESTAMP` type, which keeps indexes usable. |
| `cockroachdb`       | nothing: typeorm maps date columns to `timestamptz`, which carries its zone.                         |
| `better-sqlite3`    | nothing: `datetime('now')` stamps UTC and typeorm reads and writes the column as UTC.               |
| `mongodb`           | nothing: BSON dates are UTC.                                                                        |
| `mssql`             | nothing, see below.                                                                                 |

Settings you already made are **kept, built upon, or refused**, never silently
half-applied, since half a pin shifts values instead of fixing them:

- kept when they agree: a mysql `timezone` naming UTC (`Z`, `+00:00`), mysql
  `dateStrings: ['DATE']`, a postgres `TimeZone` naming UTC under any of its
  names (`UTC`, `Etc/UTC`, `GMT`, `Zulu`, ...; the last assignment counts, as
  in postgres);
- built upon: pg `extra.types` (timestamps are read by the pin, everything else,
  `timestamptz` included, by yours), pg `extra.Client` (subclassed), an oracle `sessionCallback`
  function (runs after the pin);
- refused with an `OptionsError`: another mysql `timezone`, other mysql
  `dateStrings`, a mysql `typeCast`, a postgres `TimeZone` naming another zone
  (in `extra.options`, the url or `PGOPTIONS`), timestamp parsers overridden in
  pg `extra.types` or process-wide with `pg.types.setTypeParser`, a postgres
  replication node url carrying `options` (the shared `extra.options` can not
  hold per-node ones), and an oracle `sessionCallback` naming a PL/SQL
  procedure.

Applying it twice returns the pinned options unchanged, and throws when a
setting of the pin was changed in between. Options pinned in code and merged
with the environment are re-checked the same way, so a `DB_DRIVER_EXTRA`
undoing part of the pin fails instead of half-applying it. Pin a copy, never
clone pinned options: a clone loses the markers the check relies on. A given `driver` is
wrapped instead of the one typeorm loads; the driver module is loaded when the
options are pinned, not when the data source connects.

Only UTC is supported: a zone-less value can be read as UTC with a marker,
while any other zone needs the offset in force at that instant.

Limits:

- **mssql** can not be pinned through the options: typeorm stamps with
  `getdate()`, the local time of the server's operating system, and SQL Server
  has no session timezone to set. The driver reads `datetime2` as UTC
  (`useUTC`, on by default), so values are right only on a server running in
  UTC. Otherwise declare the default yourself, e.g.
  `@CreateDateColumn({ default: () => 'SYSUTCDATETIME()' })`.
- **oracle** hands a zone-less `TIMESTAMP` over as a local `Date` and binds one
  from its local fields, with no option to change either, so the pin converts
  between local and UTC fields. That is exact in a process running in UTC. In a
  zone with daylight saving, a value whose UTC fields fall into the local
  spring-forward hour is read and written an hour late. A `DATE` (typeorm's
  `date` columns are calendar dates) keeps its local fields on both sides.
- **postgres streams**: pg-query-stream and pg-cursor prepare their parameters
  before the client sees them; single `Date` values are recovered from the
  local form pg gives them and sent as UTC, a `Date` inside an array parameter
  is not. A string parameter spelled exactly in that local form
  (`2026-09-22T09:05:49.850-10:00`) is rewritten as well.
- **calendar dates**: a `Date` compared with or written into a `date` column
  is now its UTC calendar date. Pass `'YYYY-MM-DD'` strings for dates, which is
  what typeorm hands back for such a column.
- **mysql** returns a `DATE` read with a raw query as a string.
- **oracle**: a `date` column filled by a database default and read back
  through `RETURNING` arrives a day early west of UTC, since the driver
  hydrates it as local midnight. `SYSDATE` and `SYSTIMESTAMP` follow the
  database host's zone, not the session's; use `SYS_EXTRACT_UTC(SYSTIMESTAMP)`
  or `CURRENT_TIMESTAMP`.

::: warning
Only values written from then on are affected. A database that ran in another
zone keeps the wall-clock values it stamped before, and those now read as UTC.
Convert them once if they matter.
:::

The same can be requested through the environment, for options read from it
and for options merged with it (`buildDataSourceOptions`, the CLI):

```bash
DB_PIN_TIMEZONE=UTC  # or TYPEORM_PIN_TIMEZONE
```

Any other value throws an `OptionsError`. The variable only reaches options
typeorm-extension builds: a data-source file which constructs its `DataSource`
itself runs unpinned in the application while the CLI would pin it, so the two
would write in different zones. Call `pinTimezone` in that file
instead.

**Parameters**

| Name       | Type                | Description                        |
|:-----------|:--------------------|:-----------------------------------|
| `options`  | `DataSourceOptions` | The options to pin.                |
| `timezone` | `'UTC'`             | The timezone to pin every side to. |

**Returns**

`DataSourceOptions`: a new object when anything was applied, otherwise the
input itself (a driver needing nothing, options already pinned). The input is
never modified.

## `DataSourceFindOptions`

```typescript
export type DataSourceFindOptions = {
    /**
     * Directory where to look for DataSource files.
     */
    directory?: string,

    /**
     * DataSource file name.
     */
    fileName?: string,

    /**
     * Preserve file paths, as if the just-in-time compilation
     * environment (e.g. tsx) is detected.
     */
    preserveFilePaths?: boolean,

    /**
     * Path to the tsconfig.json file, or its parsed content.
     *
     * Default: process.cwd() + path.sep + tsconfig.json
     */
    tsconfig?: string | TSConfig,
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
