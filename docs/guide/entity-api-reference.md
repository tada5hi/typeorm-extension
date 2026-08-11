# Entity

Utilities for inspecting and validating entities at runtime. They are aimed at
server applications that build generic repository or CRUD layers on top of TypeORM.

::: warning Experimental

Except for `getEntityName`, the helpers on this page are **experimental**.
Their signatures and behaviour can change in a minor release. Pin an exact
version if you depend on them.

:::

All helpers accept an optional `DataSource`. If none is provided, the
[registered instance](./instances.md) is resolved via `useDataSource()`.

## `getEntityName`

```typescript
declare function getEntityName<O>(
    entity: ObjectType<O> | EntitySchema<O>
) : string;
```

Resolve the name of an entity, whether it is defined as a class or as an `EntitySchema`.

**Example**

```typescript
import { EntitySchema } from 'typeorm';
import { getEntityName } from 'typeorm-extension';

class User {}

getEntityName(User); // 'User'

const schema = new EntitySchema({ name: 'user', columns: {} });
getEntityName(schema); // 'user'
```

## `getEntityMetadata`

```typescript
declare function getEntityMetadata<T extends ObjectLiteral>(
    input: Repository<T> | EntityTarget<T>,
    dataSource?: DataSource
) : Promise<EntityMetadata>;
```

Receive the `EntityMetadata` for a given repository or entity target.
Throws an `EntityMetadataError` if the entity is not registered on the data source.

**Example**

```typescript
import { getEntityMetadata } from 'typeorm-extension';
import { User } from './entities';

const metadata = await getEntityMetadata(User);
console.log(metadata.tableName);
```

## `getEntityPropertyNames`

```typescript
declare function getEntityPropertyNames<T extends ObjectLiteral>(
    input: EntityTarget<T> | Repository<T>,
    dataSource?: DataSource
) : Promise<string[]>;
```

Get the property names of a given entity: all column properties plus all relation properties.

**Example**

```typescript
import { getEntityPropertyNames } from 'typeorm-extension';
import { User } from './entities';

const names = await getEntityPropertyNames(User);
// ['id', 'name', 'email', 'role', ...]
```

## `validateEntityJoinColumns`

```typescript
declare function validateEntityJoinColumns<T extends ObjectLiteral>(
    entity: Partial<T>,
    options: {
        dataSource?: DataSource,
        entityTarget: EntityTarget<T>
    }
) : Promise<Partial<T>>;
```

Validate the join columns of a given entity payload. For every relation whose
join column is set, the referenced entity is looked up and appended to the
input entity. Throws an `EntityRelationLookupError` when a join column does not
reference anything (`notReferenced`) or the referenced entity does not exist
(`notFound`).

Typical use case: validating a write payload that carries foreign key ids
(e.g. `realm_id`) before saving, while also resolving the related records in
one step.

**Example**

```typescript
import { validateEntityJoinColumns, EntityRelationLookupError } from 'typeorm-extension';
import { User } from './entities';

try {
    await validateEntityJoinColumns(payload, {
        entityTarget: User,
    });
} catch (e) {
    if (e instanceof EntityRelationLookupError) {
        // e.relation: property name of the relation
        // e.columns: property names of the join columns
    }

    throw e;
}
```

## `isEntityUnique`

```typescript
declare function isEntityUnique<T extends ObjectLiteral>(
    options: {
        entityTarget: EntityTarget<T>,
        entity: Partial<T>,
        entityExisting?: Partial<T> | null,
        dataSource?: DataSource
    }
) : Promise<boolean>;
```

Check whether a given entity payload would violate one of the entity's unique
constraints (or unique indices, if no explicit constraints are defined).
Composite unique keys containing a `null` column are treated as present once,
so a second row with the same non-null members is reported as a conflict.

Pass the currently persisted record as `entityExisting` on updates, so the row
being updated does not conflict with itself.

**Example**

```typescript
import { isEntityUnique } from 'typeorm-extension';
import { User } from './entities';

const unique = await isEntityUnique({
    entityTarget: User,
    entity: { name: 'admin' },
});

if (!unique) {
    throw new Error('A user with this name already exists.');
}
```

## Errors

Both error classes extend `TypeormExtensionError` and can be caught explicitly:

- `EntityMetadataError`: thrown by `getEntityMetadata` (and the helpers built on
  top of it) when the entity is not registered on the data source.
- `EntityRelationLookupError`: thrown by `validateEntityJoinColumns`. Carries the
  `relation` property name and the `columns` involved in the failed lookup.
