# Seeding

## `runSeeder`

```typescript
declare function runSeeder(
    dataSource: DataSource, 
    seeder: SeederConstructor, 
    options: SeederOptions
) : Promise<vod>;
```

Populate the database with a specific seeder.

**Example: Simple**

```typescript
import { DataSource } from 'typeorm';
import { runSeeder, Seeder, SeederFactoryManager } from 'typeorm-extension';

class SimpleSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<void> {
        // ...
    }
}

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource, SimpleSeeder);
})();

```

**Example: SeederOptions**

```typescript
import { DataSource } from 'typeorm';
import { runSeeder, Seeder, SeederFactoryManager } from 'typeorm-extension';

class SimpleSeeder implements Seeder {
    public async run(
        dataSource: DataSource,
        factoryManager: SeederFactoryManager
    ): Promise<void> {
        // ...
    }
}

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeder(dataSource, SimpleSeeder, {
        factories: ['src/database/factories/*{.ts,.js}']
    });
})();
```

**Parameters**

| Name         | Type                 | Description                                                                         |
|:-------------|:---------------------|:------------------------------------------------------------------------------------|
| `dataSource` | `DataSource`         | Typeorm DataSource Object                                                           |
| `seeder`     | `SeederConstructor`  | A class which implements the Seeder Interface.                                      |
| `options`    | `SeederOptions`      | Seeding options to provide or overwrite the default ones. [Details](#seederoptions) |

**Returns**

`Promise`<`void`>

**References**
- [SeederConstructor](#seederconstructor)
- [SeederOptions](#seederoptions)

## `runSeeders`

```typescript
declare function runSeeders(
    dataSource: DataSource, 
    options: SeederOptions
) : Promise<void>;
```

Populate the database.

**Example: Simple**

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeders(dataSource);
})();

```

**Example: SeederOptions**

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';

(async () => {
    const dataSource = new DataSource({
        // ...
    });
    await dataSource.initialize();

    await runSeeders(dataSource, {
        seeds: ['src/database/seeds/*{.ts,.js}'],
        factories: ['src/database/factories/*{.ts,.js}']
    });
})();
```

**Parameters**

| Name         | Type               | Description                                                                         |
|:-------------|:-------------------|:------------------------------------------------------------------------------------|
| `dataSource` | `DataSource`       | Typeorm DataSource Object                                                           |
| `options`    | `SeederOptions`    | Seeding options to provide or overwrite the default ones. [Details](#seederoptions) |

**Returns**

`Promise`<`void`>

**References**
- [SeederOptions](#seederoptions)

## `Seeder`
```typescript
import { DataSource } from 'typeorm';
import { SeederFactoryManager } from 'typeorm-extension';

interface Seeder {
    run(dataSource: DataSource, factoryManager: SeederFactoryManager) : Promise<void>;
}
```

## `SeederConstructor`
```typescript
import { Seeder } from 'typeorm-extension';

type SeederConstructor = new () => Seeder;
```

## `SeederOptions`

```typescript
import { SeederConstructor, SeederFactoryConfig } from 'typeorm-extension';

export type SeederOptions = {
    seeds?: SeederConstructor[] | string[],
    seedName?: string,

    factories?: SeederFactoryConfig[] | string[],
    factoriesLoad?: boolean
};
```
