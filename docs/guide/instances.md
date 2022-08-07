# Instances

## Single

The default DataSource instance can be acquired, by not providing any alias at all or using the key `default`.
If no DataSource instance or DataSourceOptions object is deposited initially, the method will attempt to locate and load
the DataSource file and initialize itself from there.

```typescript
import { useDataSource } from 'typeorm-extension';

(async () => {
    const dataSource : DataSource = await useDataSource();
})();
```

Reference(s):
- [useDataSource](datasource-api-reference#usedatasource)

## Multiple

It is also possible to manage multiple DataSource instances.
Therefore, each additional DataSource must be registered under a different alias.
This can be done by either setting the DataSource instance or the DataSourceOptions object for the given alias.

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import { setDataSource, useDataSource } from 'typeorm-extension';

(async () => {
    const secondDataSourceOptions : DataSourceOptions = {
        // ...
    };

    const dataSource = new DataSource(secondDataSourceOptions);
    setDataSource(dataSource, 'second');

    const instance : DataSource = await useDataSource('second');
})();
```

Reference(s):
- [setDataSource](datasource-api-reference#setdatasource)
- [setDataSourceOptions](datasource-api-reference#setdatasourceoptions)
