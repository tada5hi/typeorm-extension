# What is it?

typeorm-extension covers the parts of a deployment that TypeORM leaves to you:

- **Create, drop and check** the database on every supported driver, from code or the CLI.
- **Detect schema drift** between the migrations and the entities, and repair it with guarded, resumable helpers.
- **Lock**: a named advisory lock to run work like migrations in one replica at a time, and a row lock for
  read-modify-write.
- **Classify driver errors**: recognize a unique or foreign key violation or a lock conflict, whichever driver raised it.
- **Seed** the database with seeder classes and factories, optionally tracked so each seeder runs once.
- **Manage data sources**: find `data-source.ts` automatically and use one or many instances by alias.

## Supported drivers

| Driver | Create / drop / check | Notes |
|--------|-----------------------|-------|
| `postgres` | yes | |
| `cockroachdb` | yes | |
| `mysql`, `mariadb` | yes | |
| `mssql` | yes | |
| `oracle` | create and check | `dropDatabase` does nothing on oracle |
| `mongodb` | yes | creates a database lazily, so `checkDatabase` reports it as existing once connected |
| `better-sqlite3` | yes | the database is a file |

TypeORM 1.0 removed the legacy `sqlite` driver; use `better-sqlite3`.
