# Seeding

## `runSeeder`

```typescript
declare function runSeeder(
    dataSource: DataSource,
    seeder: SeederConstructor | string,
    options?: SeederOptions
) : Promise<SeederEntity | undefined>;
```

Populate the database with a specific seeder, referenced by constructor or by name
(class name, file name or file path).

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

| Name         | Type                          | Description                                                                         |
|:-------------|:------------------------------|:------------------------------------------------------------------------------------|
| `dataSource` | `DataSource`                  | Typeorm DataSource Object                                                           |
| `seeder`     | `SeederConstructor` \| `string` | A class which implements the Seeder Interface, or a seeder name.                  |
| `options`    | `SeederOptions`               | Seeding options to provide or overwrite the default ones. [Details](#seederoptions) |

**Returns**

`Promise`<`SeederEntity` | `undefined`>

**References**
- [SeederConstructor](#seederconstructor)
- [SeederOptions](#seederoptions)

## `runSeeders`

```typescript
declare function runSeeders(
    dataSource: DataSource,
    options?: SeederOptions
) : Promise<SeederEntity[]>;
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

`Promise`<`SeederEntity[]`>

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
import { SeederConstructor, SeederFactoryItem } from 'typeorm-extension';

export type SeederOptions = {
    seeds?: SeederConstructor[] | string[],
    seedName?: string,
    seedTableName?: string,
    seedTracking?: boolean,

    factories?: SeederFactoryItem[] | string[],
};
```

## `resolveSeederConfig`

```typescript
declare function resolveSeederConfig(
    input?: SeederOptions,
    dataSourceOptions?: SeederOptions,
    env?: { seeds: string[], factories: string[] }
) : SeederConfig;
```

Resolve the effective seeder configuration. A pure function: explicit input wins over the
data-source options, which win over the environment values; built-in defaults apply last.
The seeder runtime uses it internally; it is exported for consumers who want to inspect
the effective configuration (e.g. in a custom CLI).

## `SeederConfig`

```typescript
import { SeederConstructor, SeederFactoryItem } from 'typeorm-extension';

export type SeederConfig = {
    seeds: SeederConstructor[] | string[],
    seedName?: string,
    seedTableName: string,
    seedTracking: boolean,

    factories: SeederFactoryItem[] | string[],
};
```

The fully resolved counterpart of [SeederOptions](#seederoptions): no optional
seeds/factories/tracking fields, defaults already applied.

## `setSeederFactory`

```typescript
declare function setSeederFactory<O extends Record<string, any>, Meta = unknown>(
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O, Meta>
) : SeederFactoryItem;
```

Register a factory for an entity with the global factory manager. Data generation is up to
the callback: import whichever generator library you prefer, this package does not provide one.

```typescript
import { faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';
import { User } from './user';

export default setSeederFactory(User, () => {
    const user = new User();
    user.firstName = faker.person.firstName();

    return user;
});
```

**References**
- [FactoryCallback](#factorycallback)

## `useSeederFactory`

```typescript
declare function useSeederFactory<O extends Record<string, any>, Meta = unknown>(
    entity: ObjectType<O> | EntitySchema<O>
) : SeederFactory<O, Meta>;
```

Obtain a factory for a registered entity from the global factory manager. Each call returns a
new `SeederFactory` instance, so `setMeta()` on one does not affect the others. Pass the `Meta`
type argument to type-check the `setMeta()` payload.

```typescript
import { useSeederFactory } from 'typeorm-extension';
import { User } from './user';

const users = await useSeederFactory<User, { lastName?: string }>(User)
    .setMeta({ lastName: 'Barrows' })
    .saveMany(5);
```

Factories obtained this way persist into the data source registered for the `default` alias.
Inside a seeder, use the `factoryManager` passed to `run()` instead: those factories are bound
to the data source of the current run.

## `FactoryCallback`

```typescript
type FactoryCallback<O, Meta = unknown> = (meta: Meta | undefined) => O | Promise<O>;
```

The callback receives the value assigned through `SeederFactory.setMeta()` and nothing else.
The argument is `undefined` when `setMeta()` was not called, which is why the parameter has to
be declared as optional (`(meta?: Meta) => …`) or handled as possibly undefined. The callback
may be synchronous or asynchronous, and may return other factories or promises as property
values: they are resolved (and persisted, for `save()`) before the entity itself.

## `resetSeederFactoryManager`

```typescript
declare function resetSeederFactoryManager() : void;
```

Reset the global factory manager: the managed instance is discarded, so the next access
(`setSeederFactory`, `useSeederFactory`, a seeder run) starts with a fresh, empty manager.
Factory instances created before the reset keep working. Useful in tests and long-lived
processes where the manager's registrations would otherwise accumulate for the lifetime of
the process.

```typescript
import { resetSeederFactoryManager } from 'typeorm-extension';

resetSeederFactoryManager();
```
