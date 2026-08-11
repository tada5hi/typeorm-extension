# Entity

Utilities for inspecting and validating entities at runtime. They are aimed at
server applications that build generic repository or CRUD layers on top of TypeORM.

::: warning Experimental

Except for `getEntityName`, the helpers on this page are **experimental**.
Their signatures and behaviour can change in a minor release. Pin an exact
version if you depend on them.

:::

Every helper which queries the database accepts an optional `DataSource`. If
none is provided, the [registered instance](./instances.md) is resolved via
`useDataSource()`. `getEntityName` is the exception: it only inspects the given
entity and never touches a data source.

## `getEntityName`

```typescript
declare function getEntityName<O>(
    entity: ObjectType<O> | EntitySchema<O> | string
) : string;
```

Resolve the name of an entity, whether it is defined as a class, as an
`EntitySchema` or already given as a name.

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
The lookup is delegated to TypeORM, so every entity target representation is
accepted: a class, an `EntitySchema`, or the entity/table name as a string.
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

The input entity is **modified in place** and returned, so the return value and
the argument are the same object. Pass a copy if the caller needs the payload
untouched.

A relation is skipped when it can not be resolved unambiguously:

- a nullable join column is `null` (the foreign key references nothing), or
- only part of a composite foreign key is provided (a lookup by the remaining
  columns could match an unrelated row).

Each relation is looked up with its own query, so the number of queries grows
with the number of relations carrying a join column value.

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

Pass the currently persisted record as `entityExisting` on updates. It serves
two purposes: the row being updated does not conflict with itself, and columns
of a unique group which the payload does not define keep their persisted value,
because an update leaves them untouched. Without `entityExisting`, an undefined
column is treated as `null`, which is what an insert would store.

::: warning Stricter than the database

A composite unique key containing a `null` is treated as present once, so a
second row with the same non-null members is reported as a conflict. Most SQL
engines consider `NULL` values distinct in a unique index and would accept that
row. The check is therefore stricter than the constraint the database enforces.

The check also runs outside of any transaction, so a concurrent write between
the check and the write can still produce a duplicate. Keep the unique
constraint on the table: it is the only mechanism which actually guarantees
uniqueness.

:::

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
