# Running from a build or a bundle

You run the CLI or the seeders on compiled JavaScript (a Docker image, a bundled function) instead of on the
TypeScript sources.

Keep the paths in `data-source.ts` written for the sources, and let the library rewrite them:

```typescript
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from 'typeorm-extension';

export const options: DataSourceOptions & SeederOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: ['src/database/entities/*.ts'],
    migrations: ['src/database/migrations/*.ts'],
    seeds: ['src/database/seeds/*.ts'],
    factories: ['src/database/factories/*.ts'],
};

export const dataSource = new DataSource(options);
```

```shell
# tsconfig.json: "outDir": "dist", sources under src/
npx tsc
node node_modules/typeorm-extension/bin/cli.mjs seed run -d src/data-source.ts
```

The second command loads `dist/data-source.js`, and the seeders from `dist/database/seeds/*.js`.

## Why it works

- Without `tsx` or `ts-node` (the loaders the library detects), every path is rewritten: a `src` segment becomes the
  `outDir` of the tsconfig (`dist` when none is set) and `.ts` becomes `.js`. This covers the `-d` path, `--name`,
  and the `entities`, `migrations`, `subscribers`, `seeds` and `factories` globs. A path which already contains the
  `outDir` keeps its directories, and a `.js` extension stays.
- The `outDir` is read from `tsconfig.json` in the root, or from the file `--tsconfig` names. Its `extends` chain is
  followed (relative paths, package specifiers such as `@tsconfig/node22/tsconfig.json`, and arrays), so an `outDir`
  set in a base config applies, relative to the file that sets it. Without the file in the image the default `dist`
  applies. When a config in the `extends` chain is missing (e.g. a `@tsconfig/*` base installed as a devDependency
  and pruned from the image), the file is read alone: its own `outDir` still applies, one set only in the base does
  not. In that case the file is read as plain JSON, so it must not contain comments.
- `--preserveFilePaths` (or `preserveFilePaths: true` in `buildDataSourceOptions`, `findDataSource` and the seeder
  executor options) turns the rewrite off. Use it when your paths already point at the build, or when you run the
  sources through a loader the library does not detect, such as Node's `--experimental-strip-types`.
- The data-source file is searched in the working directory before the `-d` directory. If the image still contains a
  `data-source.ts` next to `data-source.js`, ship only the build or run from a directory without the sources.

## Bundles

A bundler (esbuild, webpack, rollup) merges your files into one, so there is nothing left for a glob to find. Pass
the classes instead of paths, and register the factories explicitly:

```typescript
import { DataSource } from 'typeorm';
import { runSeeders } from 'typeorm-extension';
import { User } from './database/entities/user';
import { CreateMigration1700000000000 } from './database/migrations/1700000000000-create';
import { UserSeeder } from './database/seeds/user';
import { userFactory } from './database/factories/user';

const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User],
    migrations: [CreateMigration1700000000000],
});

export async function handler() {
    await dataSource.initialize();

    try {
        await dataSource.runMigrations();
        await runSeeders(dataSource, {
            seeds: [UserSeeder],
            factories: [userFactory],
        });
    } finally {
        await dataSource.destroy();
    }
}
```

`userFactory` is the value `setSeederFactory(User, ...)` returns. See [Seeding](../seeding#factories).

## Path aliases

The library does not read `paths` or `baseUrl` from the tsconfig. An import such as
`import { BaseEntity } from 'src/common/base.entity'` inside an entity or a seeder fails with `Cannot find module`
when the library loads that file. Use relative imports in every file the library loads, or run with a loader that
resolves the aliases (for example `ts-node -r tsconfig-paths/register`, or `tsx`, which reads `paths`).

## Links

- [CLI: Against a build](../cli#against-a-build)
- [Data Source](../data-source)
- [runSeeders](../seeding-api-reference#runseeders) and [DataSourceFindOptions](../datasource-api-reference#datasourcefindoptions)
