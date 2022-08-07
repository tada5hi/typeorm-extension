# CLI

The following commands are available in the terminal:
- `typeorm-extension db:create` to create the database
- `typeorm-extension db:drop` to drop the database
- `typeorm-extension seed` seed the database

Alternatively, the full command path can be set in the package.json file to run it e.g. with ts-node.

```
"scripts": {
  ...
  "db:create": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:create",
  "db:drop": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js db:drop",
  "seed": "ts-node ./node_modules/typeorm-extension/dist/cli/index.js seed"
  ...
}
```

:::info Hint
Read the [Seeding Configuration](seeding#configuration) section to find out how to specify the path,
for the seeder- & factory-location.
:::

## Options

| Option                  | Commands                        | Default         | Deprecated | Description                                                                                                                                                                                                                              |
|-------------------------|---------------------------------|-----------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--root` or `-r`        | `db:create`, `db:drop` & `seed` | `process.cwd()` | `no`       | Path to the data-source / config file.                                                                                                                                                                                                   |
| `--dataSource` or `-d`  | `db:create`, `db:drop` & `seed` | `data-source`   | `no`       | Name of the data-source file.                                                                                                                                                                                                            |
| `--synchronize` or `-s` | `db:create` & `db:drop`         | `yes`           | `no`       | Synchronize the database schema after database creation. Options: `yes` or `no`.                                                                                                                                                         |
| `--initialDatabase`     | `db:create`                     | `undefined`     | `no`       | Specify the initial database to connect to. This option is only relevant for the `postgres` driver, which must always to connect to a database. If no database is provided, the database name will be equal to the connection user name. |
| `--seed`                | `seed`                          | `undefined`     | `no`       | Specify a specific seed class to run.                                                                                                                                                                                                    |
| `--connection` or `-c`  | `db:create`, `db:drop` & `seed` | `default`       | `yes`      | Name of the connection. Required if there are multiple connections.                                                                                                                                                                      |
| `--config` or `-f`      | `db:create`, `db:drop` & `seed` | `ormconfig.js`  | `yes`      | Name to the config file.                                                                                                                                                                                                                 |
