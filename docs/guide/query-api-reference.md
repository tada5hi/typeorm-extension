# Query

:::info Hint
To get an insight on the structure of the parsed query parameter values or
to know, which values can be passed as (i.e. `buildQuery`, `parseQuery`, ...) function argument,
check out the [documentation](https://rapiq.tada5hi.net) of the [rapiq](https://www.npmjs.com/package/rapiq) library.
:::

## `applyQueryFields`

```typescript
declare function applyQueryFields<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: FieldsApplyOptions
) : FieldsApplyOutput;
```

Parse and apply fields of the main entity and optional of included relations passed in as `Record<string, string[]>` or `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields.

**Example: Simple**

```typescript
import { applyQueryFields } from 'typeorm-extension';

const fields = applyQueryFields(query, ['name'], {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(fields);
// [{alias: 'user', fields: ['name']}]
```

**Type parameters**

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


**Parameters**

| Name      | Type                      | Description                                                 |
|:----------|:--------------------------|:------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                           |
| `data`    | `unknown`                 | Fields in raw format. F.e `['name']` or `{user: ['name']}`. |
| `options` | `FieldsApplyOptions`      | Options for the fields to select.                           |

**Returns**

`FieldsApplyOutput`

The function returns an array of objects. Each object has the properties `fields` and optional `alias` and `addFields`.

**References**
- [FieldsApplyOptions](#fieldsapplyoptions)
- [FieldsApplyOutput](#fieldsapplyoutput)

## `applyQueryFilters`

```typescript
declare function applyQueryFilters<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: FiltersApplyOptions
): FiltersApplyOutput;
```

Transform filters of the main entity and optional of included relations passed in as `Record<string, unknown>` and apply them to the `SelectQueryBuilder`, in case they match the allowed filters.

**Example: Simple**

```typescript
import { applyQueryFilters } from 'typeorm-extension';

const filters = applyQueryFilters(query, {id: 1}, {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(filters);
// [{alias: 'user', key: 'id', value: 1}]
```

**Type parameters**

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


**Parameters**

| Name      | Type                      | Description                          |
|:----------|:--------------------------|:-------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.    |
| `data`    | `unknown`                 | Fields in raw format. F.e `{id: 1}`. |
| `options` | `FiltersApplyOptions`     | Options for the fields to select.    |

**Returns**

`FiltersApplyOutput`

The function returns an array of objects. Each object has the properties `key` and `value`.

**References**
- [FiltersApplyOptions](#filtersapplyoptions)
- [FiltersApplyOutput](#filtersapplyoutput)

## `applyQueryRelations`

```typescript
declare function applyQueryRelations<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: RelationsApplyOptions
): RelationsApplyOutput;
```

Transform relations passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed relations.

**Example: Simple**

```typescript
import { applyQueryRelations } from 'typeorm-extension';

const includes = applyQueryRelations(query, ['roles'], {
    allowed: ['roles', 'photos'],
    defaultAlias: 'user'
});

console.log(includes);
// [{property: 'user.roles', alias: 'roles'}]
```

**Type parameters**

| Name  | Description         |
|:------|:--------------------|
| `T`   | Typeorm entity type |


**Parameters**

| Name      | Type                      | Description                                         |
|:----------|:--------------------------|:----------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                   |
| `data`    | `unknown`                 | Relations in raw format. F.e `['roles']` or `roles` |
| `options` | `RelationsApplyOptions`   | Options for the relations to include.               |

**Returns**

`RelationsApplyOutput`

The function returns an array of objects. Each object has the properties `property` and `alias`.

**References**
- [RelationsApplyOptions](#relationsapplyoptions)
- [RelationsApplyOutput](#relationsapplyoutput)

## `applyQueryPagination`

```typescript
declare function applyQueryPagination<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: PaginationApplyOptions
): PaginationApplyOutput;
```

Transform pagination data passed in as `{limit?: number, offset?: number}` and apply it to the `SelectQueryBuilder`.

**Example: Simple**

```typescript
import { applyQueryPagination } from 'typeorm-extension';

const pagination = applyQueryPagination(query, {limit: 100}, {
    maxLimit: 50
});

console.log(pagination);
// {limit: 50}
```

**Type parameters**

| Name | Description         |
|:-----|:--------------------|
| `T`  | Typeorm entity type |


**Parameters**

| Name      | Type                      | Description                                                   |
|:----------|:--------------------------|:--------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                             |
| `data`    | `unknown`                 | Pagination data in raw format. F.e `{limit: 20, offset: 10}`. |
| `options` | `PaginationApplyOptions`  | Options for the pagination to select.                         |

**Returns**

`PaginationApplyOutput`

The function returns an object. The object might have the properties `limit` and `offset`.

**References**
- [PaginationApplyOptions](#paginationapplyoptions)
- [PaginationApplyOutput](#paginationapplyoutput)

### applyQuerySort

```typescript
declare function applyQuerySort<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: SortApplyOptions
): SortApplyOutput;
```

Transform sort fields passed in as `string`, `string[]` and apply them to the `SelectQueryBuilder`, in case they match the allowed fields to sort.

**Example: Simple**

```typescript
import { applyQuerySort } from 'typeorm-extension';

const sort = applyQuerySort(query, ['-name'], {
    allowed: ['id', 'name'],
    defaultAlias: 'user'
});

console.log(sort);
// {'user.name': 'DESC'}
```

**Type parameters**

| Name   | Description         |
|:-------|:--------------------|
| `T`    | Typeorm entity type |


**Parameters**

| Name      | Type                      | Description                                                                                                               |
|:----------|:--------------------------|:--------------------------------------------------------------------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`> | Typeorm SelectQueryBuilder Class.                                                                                         |
| `data`    | `unknown`                 | Sorting Fields in raw format. F.e `['-name']`, `-name` or `{name: 'DESC'}`. The hyphen prefix indicates descending order. |
| `options` | `SortApplyOptions`        | Options for the sorting strategy.                                                                                         |

**Returns**

`SortApplyOutput`

The function returns an objects. Each key-value pair represents a field and the corresponding sorting direction.

**References**
- [SortApplyOptions](#sortapplyoptions)
- [SortApplyOutput](#sortapplyoutput)

## `FieldsApplyOptions`

```typescript
import { FieldsParseOptions } from 'rapiq';

export type FieldsApplyOptions = FieldsParseOptions;
```

## `FieldsApplyOutput`

```typescript
import { FieldsParseOutput } from 'rapiq';

export type FieldsApplyOutput = FieldsParseOutput;
```

## `FiltersApplyOptions`

```typescript
import { FiltersParseOptions } from 'rapiq';

export type FiltersTransformOptions = {
    bindingKeyFn?: (key: string) => string,
};

export type FilterTransformOutputElement = {
    statement: string,
    binding: Record<string, any>
};
export type FiltersTransformOutput = FilterTransformOutputElement[];

// -----------------------------------------

export type FiltersApplyOptions = FiltersParseOptions & {
    transform?: FiltersTransformOptions
};
```

## `FiltersApplyOutput`

```typescript
import { FiltersParseOutput } from 'rapiq';

export type FiltersApplyOutput = FiltersParseOutput;
```

## `PaginationApplyOptions`

```typescript
import { PaginationParseOptions } from 'rapiq';

export type PaginationApplyOptions = PaginationParseOptions;
```

## `PaginationApplyOutput`

```typescript
import { PaginationParseOutput } from 'rapiq';

type PaginationApplyOutput = PaginationParseOutput;
```

## `RelationsApplyOptions`

```typescript
import { RelationsParseOptions } from 'rapiq';

export type RelationsApplyOptions = RelationsParseOptions;
```

## `RelationsApplyOutput`

```typescript
import { RelationsParseOutput } from 'rapiq';

export type RelationsApplyOutput = RelationsParseOutput;
```

## `SortApplyOptions`

```typescript

import { SortParseOptions } from 'rapiq';

export type SortApplyOptions = SortParseOptions;
```

## `SortApplyOutput`

```typescript

import { SortParseOutput } from 'rapiq';

export type SortApplyOutput = SortParseOutput;
```
