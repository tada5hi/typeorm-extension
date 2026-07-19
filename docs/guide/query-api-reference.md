# Query

::: warning Removed in v4

The query submodule (`applyQuery`, `applyQueryFields`, `applyQueryFilters`, `applyQueryRelations`,
`applyQueryPagination`, `applyQuerySort`, ...) was removed in v4.
Its successor is [@rapiq/typeorm](https://rapiq.tada5hi.net/packages/typeorm) —
the dedicated TypeORM adapter of the [rapiq](https://rapiq.tada5hi.net) v2 monorepo.

:::

To move over, follow the official migration guide:
[https://rapiq.tada5hi.net/guide/migration-typeorm-extension](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)

See also the [v4 migration guide](./migration-guide-v4.md#query-submodule-removed) of this package.

If you still need the old `applyQuery` path (e.g. on typeorm `0.3.x`), stay on `typeorm-extension` v3.
