# CLI

The following commands are available in the terminal:
- `typeorm-extension db create` to create the database
- `typeorm-extension db drop` to drop the database
- `typeorm-extension db drift` to assert that the database schema matches the entity metadata
- `typeorm-extension seed run` to seed the database
- `typeorm-extension seed create` to create a new seeder

The legacy colon-form (`db:create`, `db:drop`, `seed:run`, `seed:create`) is still accepted as a backwards-compatibility alias for each command.

If the application has not yet been built and you want to run the CLI against TypeScript sources directly, invoke the ESM bundle with a TypeScript-aware Node loader (e.g. `tsx` or Node's `--experimental-strip-types`):

```
"scripts": {
    "db:create":  "tsx ./node_modules/typeorm-extension/bin/cli.mjs db create",
    "db:drop":    "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drop",
    "db:drift":   "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift",
    "seed:run":   "tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run",
    "seed:create":"tsx ./node_modules/typeorm-extension/bin/cli.mjs seed create"
}
```

Read the [Seeding Configuration](./seeding#configuration) section to find out how to specify the path,
for the seeder- & factory-location.

#### CLI Options

| Option                  | Commands                                          | Default         | Description                                                                                                                                                                                                                              |
|-------------------------|---------------------------------------------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `process.cwd()` | Root directory of the project.                                                                                                                                                                                                           |
| `--tsconfig` or `-tc`   | `db create`, `db drift`, `db drop`, `seed run` | `tsconfig.json` | Name (or relative path incl. name) of the tsconfig file.                                                                                                                                                                                 |
| `--dataSource` or `-d`  | `db create`, `db drift`, `db drop`, `seed run` | `data-source`   | Name (or relative path incl. name) of the data-source file.                                                                                                                                                                              |
| `--synchronize` or `-s` | `db create`                                       | `yes`           | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                         |
| `--initialDatabase`     | `db create`                                       | `undefined`     | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always to connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--skipWithoutMigrations` | `db drift`                                      | `false`         | Report no drift if the data-source has no migrations registered.                                                                                                                                                                         |
| `--name` or `-n`        | `seed create` (required), `seed run` (optional)   | `undefined`     | Name (or relative path incl. name) of the seeder.                                                                                                                                                                                        |
| `--timestamp` or `-t`   | `seed create`                                     | `Date.now()`    | Custom timestamp used in the generated seeder filename.                                                                                                                                                                                  |
| `--javascript` or `-j`  | `seed create`                                     | `false`         | Generate a seeder file for JavaScript instead of TypeScript.                                                                                                                                                                             |
| `--preserveFilePaths`   | `db create`, `db drift`, `db drop`, `seed run` | `false`         | This option indicates if file paths should be preserved and treated as if the just-in-time compilation environment is detected.                                                                                                          |
| `--log-level`           | `db create`, `db drift`, `db drop`, `seed create`, `seed run` | `info`          | Logger verbosity. One of `silent`, `info`, `debug`.                                                                                                                                                                                      |

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
