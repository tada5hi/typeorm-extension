# Schema drift check in CI

Your migrations and your entities describe the same schema, and you want CI to fail as soon as they disagree.

```yaml
name: schema

on: [push, pull_request]

jobs:
    drift:
        runs-on: ubuntu-latest
        services:
            database:
                image: postgres:18-alpine
                env:
                    POSTGRES_USER: test
                    POSTGRES_PASSWORD: test
                    POSTGRES_DB: test
                ports:
                    - 5432:5432
                options: >-
                    --health-cmd "pg_isready -U test"
                    --health-interval 5s
                    --health-timeout 5s
                    --health-retries 10
        env:
            TYPEORM_CONNECTION: postgres
            TYPEORM_HOST: 127.0.0.1
            TYPEORM_PORT: 5432
            TYPEORM_USERNAME: test
            TYPEORM_PASSWORD: test
            TYPEORM_DATABASE: test
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 24
            - run: npm ci
            - run: npm run build
            # creates the database if needed and runs the migrations
            - run: npx typeorm-extension db create -d src/data-source.ts
            # exit code 1 and the reconciling statements if the schema deviates
            - run: npx typeorm-extension db drift -d src/data-source.ts
```

The CLI reads the `TYPEORM_*` variables and merges them into the options of the data-source file (see
[Data Source](../data-source)). If your `data-source.ts` reads variables of its own, set those in the `env` block
instead.

## Why it works

- `db create` runs the migrations when the data source configures any (and `synchronize(false)` only when it
  configures none), so the drift check sees the schema the migrations produce.
- `db drift` compares that schema with the entity metadata and never writes. It exits with `1` and prints the
  statements when they differ, and with `2` on any other error, such as a failed connection.
- The CLI runs on the build here, so `-d src/data-source.ts` loads `dist/data-source.js` (see
  [Running from a build](./production-build)). Without a build step, run it with `tsx` instead.
- Add `--skipWithoutMigrations` when the same data-source file also serves a `synchronize()` driven setup without
  migrations (for example `migrations: []` for sqlite): the check then passes there instead of reporting the whole
  schema.

## In a test instead

To keep the check in your test suite, call `getSchemaDrift` after the migrations have run:

```typescript
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { getSchemaDrift } from 'typeorm-extension';
import { options } from '../src/data-source';

describe('schema', () => {
    it('matches the entities after the migrations', async () => {
        const dataSource = new DataSource({ ...options, migrationsRun: false, synchronize: false });
        await dataSource.initialize();

        try {
            await dataSource.runMigrations();

            const drift = await getSchemaDrift(dataSource, { skipWithoutMigrations: true });

            expect(drift.up.map((statement) => statement.query)).toEqual([]);
        } finally {
            await dataSource.destroy();
        }
    });
});
```

Comparing the statements rather than `drift.exists` puts them in the test output when the check fails.

## Links

- [Schema drift](../schema#schema-drift) and [getSchemaDrift](../database-api-reference#getschemadrift)
- [CLI: Schema Drift](../cli#schema-drift)
- [Database: Create](../database#create)
