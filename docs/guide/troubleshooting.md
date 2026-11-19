# Troubleshooting

This page lists errors you may see, why they happen and how to fix them. Each heading is the message or symptom as you
see it.

## `OptionsError: The database options could not be located/loaded.`

**Cause:** no data source file was found, the file has no export that is a `DataSource` (or a promise of one), and
the environment names no driver (`DB_TYPE` or a `DB_URL` with a scheme).

**Fix:**

- Export a `DataSource` instance, not only its options: `export const dataSource = new DataSource(options)`.
- Point the CLI at the file with `-d`, e.g. `-d src/config/orm.ts`. The path is relative to `--root`.
- Outside `tsx` and `ts-node`, `src` in the path is rewritten to your tsconfig `outDir` (default `dist`). If you run
  TypeScript sources with plain Node, or there is no build yet, pass `--preserveFilePaths` or run the CLI with `tsx`.

See [Discovery](./data-source#discovery).

## `SyntaxError: The requested module 'typeorm' does not provide an export named 'DataSourceOptions'`

**Cause:** Node loads your `.ts` file itself (type stripping, on by default since Node 22.18). It removes type
annotations but keeps every import, so an import of a type fails at runtime.

**Fix:** import types with `import type`:

```typescript
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
```

See [Discovery](./data-source#discovery).

## `SyntaxError: Invalid or unexpected token` at a decorator

**Cause:** Node's type stripping does not support decorators such as `@Entity()`, so plain Node cannot load your
entity files.

**Fix:** run the CLI with `tsx` (`tsx ./node_modules/typeorm-extension/bin/cli.mjs ...`), or run it against your build.

See [CLI](./cli).

## `Error: Cannot find module 'src/...'`

**Cause:** your code imports through a tsconfig path alias or `baseUrl` (e.g. `from 'src/common/base.entity'`). Node
does not read tsconfig, so it cannot resolve the import when the seeder or the data source file is loaded.

**Fix:** use relative imports, or a runtime that resolves tsconfig paths (`tsx` does). For a build, use relative
imports or a build step that rewrites the aliases.

See [Running from a build](./recipes/production-build).

## Seeders, factories or entities are not found when you run the build

**Cause:** outside `tsx` and `ts-node`, the library assumes compiled code. It replaces `src` in string paths
(`entities`, `migrations`, `subscribers`, `seeds`, `factories`, `-d`) with the tsconfig `outDir` and `.ts` with `.js`.
If your build does not mirror `src` below `outDir` (e.g. a monorepo that builds to `dist/apps/<name>`), the globs
match nothing.

**Fix:** point the globs at the build output, pass `--preserveFilePaths` with paths that are already correct, or
pass classes instead of globs.

See [Running from a build](./recipes/production-build).

## `EntityMetadataNotFoundError: No metadata for "User" was found.`

**Cause:** the entity is not part of the data source. Its class is missing from `entities`, or the `entities` glob
matches no file (see the build rewrite above).

**Fix:** add the entity class to `entities`, or fix the glob. A data source that uses the entity must list it, also
when only a seeder or factory uses it.

See [Data Source](./data-source).

## `Error: No seeder factory is registered for the entity: User`

**Cause:** `factoryManager.get(User)` found no factory for the entity name. The `factories` glob matched no file, so
no `setSeederFactory()` call ran. Without configuration, the glob is `src/database/factories/**/*{.ts,.js}`.

**Fix:** set `factories` in the data source options (or `DB_FACTORIES`) to the files that call `setSeederFactory()`,
or pass the factories themselves: `factories: [userFactory]`.

See [Factories](./seeding#factories).

## `error: database "app" does not exist` when you create a postgres database

**Cause:** postgres needs a database to connect to before it can run `CREATE DATABASE`. Without an initial database,
the postgres client connects to the database named like the user (or `PGDATABASE`).

**Fix:** name an existing database, usually `postgres`:

```shell
typeorm-extension db create --initialDatabase postgres
```

In code, pass `initialDatabase: 'postgres'` to `createDatabase()` or `dropDatabase()`.

See [Database](./database#create).

## Variables from `.env` are ignored

**Cause:** the library reads `process.env` only. It does not load `.env` files.

**Fix:** load the file when the process starts, e.g. `node --env-file=.env ...` or `tsx --env-file=.env ...`, or
load it at the top of your data source file (e.g. with `dotenv`). The environment is read once and cached: in tests,
call `resetEnv()` after you change `process.env`.

See [Environment variables](./data-source#environment-variables).

## `Error: Duplicate seeds: <name>`

**Cause:** two seeders have the same class name. The class name is the seeder's name, so anonymous classes
(`export default class implements Seeder`) can end up with the same name, e.g. `default`.

**Fix:** give each seeder class its own name.

See [Tracking](./seeding#tracking).

## Can I revert seeds?

No. A seeder has only `run()`, no `down()` step, so the library cannot undo what it wrote. Seeders run on every
`seed run` unless tracking is on (`seedTracking: true` or `track = true` on the class). A tracked seeder is recorded
by class name in the `seeds` table and skipped from then on. To run it again, delete its row. To remove the data,
write a migration, or in development drop and create the database (`db drop`, then `db create`).

See [Tracking](./seeding#tracking).
