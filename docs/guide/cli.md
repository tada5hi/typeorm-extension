# CLI

The following commands are available in the terminal:
- `typeorm-extension db create` to create the database
- `typeorm-extension db drop` to drop the database
- `typeorm-extension db drift` to assert that the database schema matches the entity metadata
- `typeorm-extension seed run` to seed the database
- `typeorm-extension seed create` to create a new seeder

The legacy colon-form (`db:create`, `db:drop`, `seed:run`, `seed:create`) is still accepted as a backwards-compatibility alias for each command.

The CLI looks for a `data-source.{ts,js}` file in the project root, `src/`, `src/db/` and `src/database/`, or uses
the file you pass with `-d`. See the [Data Source](./data-source) page for how the file is found and which exports it
accepts.

## Against TypeScript sources

Before the application is built, run the ESM bundle with a TypeScript-aware loader such as `tsx` (or `ts-node`):

```json
"scripts": {
    "db:create":  "tsx ./node_modules/typeorm-extension/bin/cli.mjs db create",
    "db:drop":    "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drop",
    "db:drift":   "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift",
    "seed:run":   "tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run",
    "seed:create":"tsx ./node_modules/typeorm-extension/bin/cli.mjs seed create"
}
```

The CLI detects `tsx` and `ts-node` and then uses the paths as given. Under other loaders, such as Node's own type
stripping, the paths are rewritten as for a build (see below), but a rewritten path that matches nothing falls back to
the path as given. Node's type stripping does not support decorators, though: this only helps when no decorated
class is loaded from a `.ts` file (entities defined with `EntitySchema`, or `entities` and `migrations` pointing at
compiled `.js` files). A project with `@Entity()` classes in `src` still needs `tsx` (or `ts-node`) or a build, see
[Troubleshooting](./troubleshooting#syntaxerror-invalid-or-unexpected-token-at-a-decorator).

## Against a build

After `tsc` (or another compiler) has written the JavaScript files, run the binary with plain Node:

```json
"scripts": {
    "db:create": "typeorm-extension db create -d src/data-source.ts",
    "seed:run":  "typeorm-extension seed run -d src/data-source.ts"
}
```

`npx typeorm-extension ...` and `node node_modules/typeorm-extension/bin/cli.mjs ...` do the same. Without a
TypeScript loader, the CLI rewrites every path from `src` to the `outDir` of the tsconfig (default `dist`) and `.ts`
to `.js`: the `-d` path, `--name`, and the `entities`, `migrations`, `subscribers`, `seeds` and `factories` globs. So
`-d src/data-source.ts` loads `dist/data-source.js`. When the rewritten path matches nothing but the given one does,
the given path is used. Pass `--tsconfig` when the tsconfig is not `tsconfig.json` in the root, or
`--preserveFilePaths` to always use the paths as given. The recipe
[Running from a build or a bundle](./recipes/production-build) covers the details.

Read the [Seeding Configuration](./seeding#configuration) section to find out how to specify the path,
for the seeder- & factory-location.

## Options

| Option                  | Commands                                          | Default         | Description                                                                                                                                                                                                                              |
|-------------------------|---------------------------------------------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `process.cwd()` | Root directory of the project.                                                                                                                                                                                                           |
| `--tsconfig` or `-tc`   | `db create`, `db drift`, `db drop`, `seed run` | `tsconfig.json` | Name (or relative path incl. name) of the tsconfig file.                                                                                                                                                                                 |
| `--dataSource` or `-d`  | `db create`, `db drift`, `db drop`, `seed run` | `data-source`   | Name (or relative path incl. name) of the data-source file.                                                                                                                                                                              |
| `--synchronize` or `-s` | `db create`                                       | `yes`           | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                         |
| `--initialDatabase`     | `db create`, `db drop`                            | `undefined`     | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--skipWithoutMigrations` | `db drift`                                      | `false`         | Report no drift if the data-source has no migrations registered.                                                                                                                                                                         |
| `--name` or `-n`        | `seed create` (required), `seed run` (optional)   | `undefined`     | Name (or relative path incl. name) of the seeder.                                                                                                                                                                                        |
| `--timestamp` or `-t`   | `seed create`                                     | `Date.now()`    | Custom timestamp used in the generated seeder filename.                                                                                                                                                                                  |
| `--javascript` or `-j`  | `seed create`                                     | `false`         | Generate a seeder file for JavaScript instead of TypeScript.                                                                                                                                                                             |
| `--preserveFilePaths`   | `db create`, `db drift`, `db drop`, `seed run` | `false`         | This option indicates if file paths should be preserved and treated as if the just-in-time compilation environment is detected.                                                                                                          |
| `--log-level`           | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `info`          | Logger verbosity. One of `silent`, `info`, `debug`.                                                                                                                                                                                      |

## Examples

```shell
# create the database and run the migrations (or synchronize without migrations)
npx typeorm-extension db create -d src/data-source.ts

# create the database only
npx typeorm-extension db create -d src/data-source.ts --synchronize no

# postgres: connect to another database than the user name to run CREATE DATABASE
npx typeorm-extension db create -d src/data-source.ts --initialDatabase postgres

# drop the database
npx typeorm-extension db drop -d src/data-source.ts

# fail with exit code 1 if the schema deviates from the entities
npx typeorm-extension db drift -d src/data-source.ts

# run all seeders, or a single one by name or path
npx typeorm-extension seed run -d src/data-source.ts
npx typeorm-extension seed run -d src/data-source.ts --name src/database/seeds/user.ts

# create a seeder file (a timestamp is put in front of the name)
npx typeorm-extension seed create --name src/database/seeds/user.ts
```

Every command exits with `0` on success, `1` on a user error (such as schema drift) and `2` on any other error.

## Schema Drift

`db drift` compares the database schema against the entity metadata and exits with code `1` if the two deviate,
printing the statements which would reconcile them.

It is meant as a CI gate right after the migrations have run. A project which builds its schema with migrations in
production but with `synchronize()` in tests has no guard against the two descriptions drifting apart, and the failure
mode stays silent until someone generates the next migration, which may then contain data-destroying statements that
look routine in review:

```
migration run  ->  revert x N  ->  run  ->  db drift
```

```shell
tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift -d src/data-source.ts
```

Pass `--skipWithoutMigrations` to exit successfully if the data-source has no migrations registered. This is useful when the
same data-source file serves a migration driven environment and a `synchronize()` driven one
(e.g. `migrations: []` for an in-memory sqlite test database).

The check never writes to the database: the data-source built from the discovered options is built with
`synchronize`, `migrationsRun` and `dropSchema` disabled.

The recipe [Schema drift check in CI](./recipes/drift-in-ci) shows a complete CI job, and [Schema](./schema#schema-drift)
the programmatic form.
