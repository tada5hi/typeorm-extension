# Query

::: warning Removed in v4

The query submodule (`applyQuery`, `applyQueryFields`, `applyQueryFilters`, `applyQueryRelations`,
`applyQueryPagination`, `applyQuerySort`, ...) was removed in v4.
Its successor is [@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm),
the dedicated TypeORM adapter of the [rapiq](https://github.com/tada5hi/rapiq) v2 monorepo.

:::

To move over, follow the official migration guide:
[https://rapiq.tada5hi.net/guide/migration-typeorm-extension](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)

See also the [v4 migration guide](./migration-guide-v4.md#query-submodule-removed) of this package.

If you still need the old `applyQuery` path (e.g. on typeorm `0.3.x`), stay on `typeorm-extension` v3.

::: info Scheduled for removal
This page is kept during the v4 release cycle to route former `applyQuery` users to the successor.
With the next major release (v5) it will be removed; the [rapiq documentation](https://rapiq.tada5hi.net)
is the canonical reference.
:::
