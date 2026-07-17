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
a caller supplied server-level connection can be injected instead — for example an
existing admin pool or a tunnelled connection. The library never closes an injected
connection; its lifecycle stays with the caller.

```typescript
import { createDatabase } from 'typeorm-extension';
import { pool } from './admin-pool';

(async () => {
    await createDatabase({
        options,
        connection: {
            execute: (sql) => pool.query(sql),
            close: async () => { /* caller owns the pool */ },
        },
    });
})();
```

The injected object provides the `execute` / `close` part of the `IDatabaseSession` interface and is treated as already open — the library never opens or closes it. For full control
over how connections are opened (e.g. per-database session targeting), implement the
`IDatabaseConnector` interface instead — both types are exported from the package.

::: warning NOTE
The former per-driver helpers (`createPostgresDatabase`, `dropMySQLDatabase`, ...)
are deprecated and will be removed in the next major release. Use `createDatabase` /
`dropDatabase` — the driver is dispatched automatically from the `type` of the
provided options. For oracle, dropping a database is not supported and the create
statement is passed through unchanged.
:::
