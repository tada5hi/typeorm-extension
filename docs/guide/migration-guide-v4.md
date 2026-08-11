# Upgrading to v4

This is the migration guide for upgrading from **v3** to **v4**. v4 modernizes the toolchain (ESM-only, Node ≥ 22, new bundler / test runner / linter) **and** moves the typeorm peer-dep to `^1.1.0`. TypeORM `0.3.x` is no longer supported. Stay on `typeorm-extension` v3 if you need it.

## Breaking Changes

### Package is ESM-only

`typeorm-extension` no longer publishes a CommonJS build. Consumers must use Node ≥ 22 (which supports `require(esm)` for legacy CJS code paths).

| | v3 | v4 |
|---|---|---|
| `main` | `dist/index.cjs` | `dist/index.mjs` |
| `module` | `dist/index.mjs` | _removed_ |
| `types` | `dist/index.d.ts` | `dist/index.d.mts` |

### Single CLI binary

The dual binary scheme is gone. There is now one binary, `typeorm-extension`, backed by `bin/cli.mjs`.

| v3 | v4 |
|---|---|
| `typeorm-extension` → `bin/cli.cjs` | `typeorm-extension` → `bin/cli.mjs` |
| `typeorm-extension-esm` → `bin/cli.mjs` | _removed_ |

Update any `package.json` scripts:

```diff
- "db:create": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:create"
+ "db:create": "tsx ./node_modules/typeorm-extension/bin/cli.mjs db:create"
```

You can use any TypeScript-aware loader (`tsx`, Node's `--experimental-strip-types`, `bun`, …). `ts-node` is no longer recommended because its ESM mode requires extra setup.

`ts-node` and `tsx` are detected automatically, so file paths are kept as-is (no `src` → `dist` rewrite). For other loaders, pass `--preserveFilePaths` to get the same behaviour.

### Minimum Node.js version

| v3 | v4 |
|---|---|
| `^20.19.0 \|\| ^22.13.0 \|\| ^23.5.0 \|\| >=24.0.0` | `>=22.0.0` |

### Peer dependency: TypeORM

| v3 | v4 |
|---|---|
| `typeorm ~0.3.0` | `typeorm ^1.1.0` |

TypeORM `0.3.x` is **not** supported on `typeorm-extension` v4+. Pick the row that fits you:

- Already on TypeORM `1.x`: upgrade to `typeorm-extension` v4.
- Still on TypeORM `0.3.x`: stay on `typeorm-extension` v3 until you can migrate the rest of your app to TypeORM `1.0`.

The TypeORM 1.0 upstream changes that affect `typeorm-extension` consumers:

- **`sqlite` driver removed**: TypeORM 1.0 dropped the `sqlite` package; only `better-sqlite3` is supported. `typeorm-extension` follows suit and only handles `better-sqlite3` in `createDatabase` / `dropDatabase` / `TYPEORM_CONNECTION`.
- **MongoDB**: requires `mongodb` `^7.0.0`.
- **MySQL**: only the `mysql2` package is supported (the legacy `mysql` package is removed).
- **Node.js**: TypeORM 1.0 requires Node `^20.19.0 || ^22.13.0 || >=24.11.0`. `typeorm-extension` v4 already requires Node `>=22.0.0`.

See the [TypeORM 1.0 release notes](https://typeorm.io/docs/releases/1.0/release-notes/) for the full list of upstream breaking changes.

### Seeder execution no longer registers the data source globally

In v3, constructing a `SeederExecutor` (which `runSeeder` / `runSeeders` do internally) registered the
given data source under the `default` alias as a side effect, silently repointing what
`useDataSource()` returns everywhere else in the process.

In v4, the executor leaves the data-source registry untouched. Factories resolved through the
`factoryManager` passed to `Seeder.run()` are bound to the executor's data source, so factory
`save()` / `saveMany()` still persist into the seeded database. If other code relies on
`useDataSource()` returning the seeded data source, register it explicitly:

```typescript
import { runSeeders, setDataSource } from 'typeorm-extension';

setDataSource(dataSource); // was implicit in v3
await runSeeders(dataSource);
```

### Factory callback no longer receives a faker instance

In v3, the factory callback was handed a `Faker` instance built by this package, and
`@faker-js/faker` was a peer dependency that every consumer installed, even projects that never
seed anything.

In v4, `typeorm-extension` no longer depends on a data generator at all. The callback signature is
`(meta) => Entity`, and the factory file imports the generator itself. faker keeps working exactly
as before, it is just yours now:

```typescript
// v3
export default setSeederFactory(User, (faker) => {
    const user = new User();
    user.firstName = faker.person.firstName();

    return user;
});

// v4
import { faker } from '@faker-js/faker';

export default setSeederFactory(User, () => {
    const user = new User();
    user.firstName = faker.person.firstName();

    return user;
});
```

Install it yourself if you use it: `npm install @faker-js/faker --save-dev`.

TypeScript reports the change at the call site in both spellings a v3 factory can have. An
un-annotated `(faker) => ...` makes the parameter `unknown`, and an annotated `(faker: Faker) => ...`
is rejected because the callback argument may be `undefined`:

```
Argument of type '(faker: Faker) => User' is not assignable to parameter of type
'FactoryCallback<User, Faker>'. Type 'Faker | undefined' is not assignable to type 'Faker'.
```

Plain JavaScript projects get no compile-time signal at all, so check every factory file there for a
callback that still expects a generator argument.

The same rule applies when you do use the meta payload: declare the parameter as optional, because it
is `undefined` until `setMeta()` is called.

```typescript
setSeederFactory(User, (meta?: { lastName?: string }) => { ... });
```

`SeederFactory.setLocale()` is removed as well. Select the locale (and seed the generator for
reproducible runs) through the generator's own API:

```typescript
import { fakerDE as faker } from '@faker-js/faker';

faker.seed(1234);
```

### Query submodule removed

The query submodule (`applyQuery`, `applyFilters` / `applyQueryFilters`, `applyFields` / `applyQueryFields`,
`applyRelations` / `applyQueryRelations`, `applyPagination` / `applyQueryPagination`, `applySort` / `applyQuerySort`,
the `applyQuery*ParseOutput` functions and their option/output types) has been removed, together with the
hard `rapiq` dependency.

Its successor is **[@rapiq/adapter-typeorm](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm)**, the dedicated TypeORM
adapter of the rapiq v2 monorepo. The replacement flow: define a `Schema` for the entity, decode the raw
URL query string with `URLCodec.decode` (from `@rapiq/codec-url`), and hand the parsed query to
`TypeormAdapter.execute`, which applies it onto the `SelectQueryBuilder`. It covers everything the old
submodule did and fixes long-standing limitations (nested `and` / `or` filter compounds, the `contains`
operator family, collision-free join aliases).

Follow the official migration guide:
[https://rapiq.tada5hi.net/guide/migration-typeorm-extension](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)

Notes:

- `@rapiq/adapter-typeorm` requires `typeorm ^1.1.0`, the same floor as `typeorm-extension` v4.
- If you still need the old `applyQuery` path (e.g. on typeorm `0.3.x`), stay on `typeorm-extension` v3.

## Internal Toolchain (no consumer impact)

For contributors only:

- Bundler: Rollup + swc → **[tsdown](https://tsdown.dev)** (rolldown + oxc)
- Test runner: Jest + ts-jest → **Vitest 4** with `unplugin-swc`
- Linter: ESLint 8 + `@tada5hi/eslint-config-typescript` → **ESLint 10** flat config + `@tada5hi/eslint-config` v2
- Publish action: `workspaces-publish` → **[`tada5hi/monoship@v2`](https://github.com/tada5hi/monoship)**
- Husky 9 hooks now in v9 format (no shebang, no `_/husky.sh` source)
- TypeScript 5 → **TypeScript 6**
