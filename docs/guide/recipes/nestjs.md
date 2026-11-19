# NestJS

Your NestJS app configures TypeORM through its modules, and you want the `typeorm-extension` CLI and the seeders to
use the same configuration.

::: info NOTE
The parts which import `@nestjs/*` target `@nestjs/typeorm` 11 and are not type-checked against NestJS in this
repository. The configuration function and the data-source file are.
:::

Put the configuration in a plain function which reads `process.env`, so it works without Nest's dependency injection:

```typescript
// src/database/options.ts
import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';

export function buildDatabaseOptions(): DataSourceOptions & SeederOptions {
    return {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        entities: ['src/**/*.entity.ts'],
        migrations: ['src/database/migrations/*.ts'],
        seeds: ['src/database/seeds/*.ts'],
        factories: ['src/database/factories/*.ts'],
    };
}
```

The CLI gets a `data-source.ts` of its own, which the Nest app never imports:

```typescript
// src/database/data-source.ts
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './options';

export const dataSource = new DataSource(buildDatabaseOptions());
```

```shell
npx tsx ./node_modules/typeorm-extension/bin/cli.mjs db create -d src/database/data-source.ts
npx tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run -d src/database/data-source.ts
```

The Nest app uses the same function, and seeds from code once it has started:

```typescript
// src/app.module.ts
import { Injectable, Module } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { buildDatabaseOptions } from './database/options';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
    constructor(private readonly dataSource: DataSource) {}

    async onApplicationBootstrap() {
        if (process.env.DB_SEED === 'true') {
            await runSeeders(this.dataSource, { seedTracking: true });
        }
    }
}

@Module({
    imports: [TypeOrmModule.forRootAsync({ useFactory: () => buildDatabaseOptions() })],
    providers: [SeedService],
})
export class AppModule {}
```

## Why it works

- `ConfigService` only exists inside the Nest container, and the CLI runs outside it. A plain function reading
  `process.env` works in both. `typeorm-extension` does not load `.env`, so load it yourself (for example
  `tsx --env-file=.env ...`).
- `runSeeders` reads `seeds` and `factories` from the options of the injected `DataSource`, which
  `@nestjs/typeorm` built from the same function. `seedTracking: true` runs each seeder once per database, so a
  restart does not seed again.
- The paths in `buildDatabaseOptions` point at the sources. On a build, the CLI rewrites all of them to the
  `outDir`, and `runSeeders` rewrites `seeds` and `factories` (see [Running from a build](./production-build)).
  typeorm does not rewrite `entities` and `migrations` inside the Nest app, so give the app compiled paths or classes
  there (for example `autoLoadEntities: true` with `TypeOrmModule.forFeature`).

## Links

- [Data Source](../data-source)
- [CLI](../cli)
- [runSeeders](../seeding-api-reference#runseeders)
