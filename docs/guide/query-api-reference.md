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
    options?: QueryFieldsApplyOptions<T>
): QueryFieldsApplyOutput;
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

| Name      | Type                           | Description                                                 |
|:----------|:-------------------------------|:------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`>      | Typeorm SelectQueryBuilder Class.                           |
| `data`    | `unknown`                      | Fields in raw format. F.e `['name']` or `{user: ['name']}`. |
| `options` | `QueryFieldsApplyOptions`<`T`> | Options for the fields to select.                           |

**Returns**

`QueryFieldsApplyOutput`

The function returns an array of objects. Each object has the properties `fields` and optional `alias` and `addFields`.

**References**
- [QueryFieldsApplyOptions](#queryfieldsapplyoptions)
- [QueryFieldsApplyOutput](#queryfieldsapplyoutput)

## `applyQueryFilters`

```typescript
declare function applyQueryFilters<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: QueryFiltersApplyOptions<T>
): QueryFiltersApplyOutput;
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

| Name      | Type                            | Description                          |
|:----------|:--------------------------------|:-------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`>       | Typeorm SelectQueryBuilder Class.    |
| `data`    | `unknown`                       | Fields in raw format. F.e `{id: 1}`. |
| `options` | `QueryFiltersApplyOptions`<`T`> | Options for the fields to select.    |

**Returns**

`QueryFiltersApplyOutput`

The function returns an array of objects. Each object has the properties `key` and `value`.

**References**
- [QueryFiltersApplyOptions](#queryfiltersapplyoptions)
- [QueryFiltersApplyOutput](#queryfiltersapplyoutput)

## `applyQueryRelations`

```typescript
declare function applyQueryRelations<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: QueryRelationsApplyOptions<T>
): QueryRelationsApplyOutput;
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

| Name      | Type                              | Description                                         |
|:----------|:----------------------------------|:----------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`>         | Typeorm SelectQueryBuilder Class.                   |
| `data`    | `unknown`                         | Relations in raw format. F.e `['roles']` or `roles` |
| `options` | `QueryRelationsApplyOptions`<`T`> | Options for the relations to include.               |

**Returns**

`QueryRelationsApplyOutput`

The function returns an array of objects. Each object has the properties `property` and `alias`.

**References**
- [QueryRelationsApplyOptions](#queryrelationsapplyoptions)
- [QueryRelationsApplyOutput](#queryrelationsapplyoutput)

## `applyQueryPagination`

```typescript
declare function applyQueryPagination<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: QueryPaginationApplyOptions
): QueryPaginationApplyOutput;
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

| Name      | Type                             | Description                                                   |
|:----------|:---------------------------------|:--------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`>        | Typeorm SelectQueryBuilder Class.                             |
| `data`    | `unknown`                        | Pagination data in raw format. F.e `{limit: 20, offset: 10}`. |
| `options` | `QueryPaginationApplyOptions`    | Options for the pagination to select.                         |

**Returns**

`QueryPaginationApplyOutput`

The function returns an object. The object might have the properties `limit` and `offset`.

**References**
- [QueryPaginationApplyOptions](#querypaginationapplyoptions)
- [QueryPaginationApplyOutput](#querypaginationapplyoutput)

### applyQuerySort

```typescript
declare function applyQuerySort<T>(
    query: SelectQueryBuilder<T>,
    data: unknown, 
    options?: QuerySortApplyOptions<T>
): QuerySortApplyOutput;
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

| Name      | Type                         | Description                                                                                                               |
|:----------|:-----------------------------|:--------------------------------------------------------------------------------------------------------------------------|
| `query`   | `SelectQueryBuilder`<`T`>    | Typeorm SelectQueryBuilder Class.                                                                                         |
| `data`    | `unknown`                    | Sorting Fields in raw format. F.e `['-name']`, `-name` or `{name: 'DESC'}`. The hyphen prefix indicates descending order. |
| `options` | `QuerySortApplyOptions`<`T`> | Options for the sorting strategy.                                                                                         |

**Returns**

`QuerySortApplyOutput`

The function returns an objects. Each key-value pair represents a field and the corresponding sorting direction.

**References**
- [QuerySortApplyOptions](#querysortapplyoptions)
- [QuerySortApplyOutput](#querysortapplyoutput)

## `QueryFieldsApplyOptions`

```typescript
import { FieldsParseOptions } from 'rapiq';

export type QueryFieldsApplyOptions<T> = FieldsParseOptions<T>;
```

## `QueryFieldsApplyOutput`

```typescript
import { FieldsParseOutput } from 'rapiq';

export type QueryFieldsApplyOutput = FieldsParseOutput & {
    defaultAlias?: string
};
```

## `QueryFiltersApplyOptions`

```typescript
import { FiltersParseOptions } from 'rapiq';

export type QueryFiltersApplyOptions<T> = FiltersParseOptions<T> & {
    defaultAlias?: string,
    bindindKey?: (key: string) => string
};
```

## `QueryFiltersApplyOutput`

```typescript
import { FiltersParseOutput } from 'rapiq';

export type QueryFiltersApplyOutput = FiltersParseOutput;
```

## `QueryPaginationApplyOptions`

```typescript
import { PaginationParseOptions } from 'rapiq';

export type QueryPaginationApplyOptions = PaginationParseOptions;
```

## `QueryPaginationApplyOutput`

```typescript
import { PaginationParseOutput } from 'rapiq';

type QueryPaginationApplyOutput = PaginationParseOutput;
```

## `QueryRelationsApplyOptions`

```typescript
import { RelationsParseOptions } from 'rapiq';

export type QueryRelationsApplyOptions<T> = RelationsParseOptions<T> & {
    defaultAlias?: string
};
```

## `QueryRelationsApplyOutput`

```typescript
import { RelationsParseOutput } from 'rapiq';

export type QueryRelationsApplyOutput = RelationsParseOutput;
```

## `QuerySortApplyOptions`

```typescript

import { SortParseOptions } from 'rapiq';

export type QuerySortApplyOptions<T> = SortParseOptions<T> & {
    defaultAlias?: string
};
```

## `QuerySortApplyOutput`

```typescript

import { SortParseOutput } from 'rapiq';

export type QuerySortApplyOutput = SortParseOutput;
```
