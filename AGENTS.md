<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# typeorm-extension — Agent Guide

A TypeScript library that extends [TypeORM](https://typeorm.io) with:

- `create` / `drop` databases across all supported drivers (Postgres, MySQL/MariaDB, MongoDB, MSSQL, Oracle, SQLite/better-sqlite3, CockroachDB).
- A seeder/factory system (similar to Laravel) backed by `@faker-js/faker`.
- A data-source registry with auto-discovery and lazy initialization.
- A JSON:API-style query parameter parser that applies `fields`, `filters`, `relations`, `sort`, and `page` onto a `SelectQueryBuilder`.
- A CLI (`typeorm-extension`) wrapping the above for use in npm scripts.

Published to npm as `typeorm-extension`. `typeorm` and `@faker-js/faker` are peer dependencies.

## Quick Reference

```bash
# Setup
npm install

# Development
npm run build              # tsc --emitDeclarationOnly + rollup -c
npm run build:watch        # rebuild on change
npm test                   # jest --config ./test/jest.config.js
npm run test:coverage      # jest with coverage (thresholds enforced)
npm run lint               # eslint src + test
npm run lint:fix
npm run docs:dev           # vitepress dev server for docs/
```

- **Node.js**: `^20.19.0 || ^22.13.0 || ^23.5.0 || >=24.0.0`
- **Package manager**: npm
- **Build orchestration**: Rollup (`rollup.config.mjs`) with `@swc/core` for transpilation; `tsc` only emits `.d.ts` files

### CLI Entry Points

| Binary                     | Source                  | Output         |
|----------------------------|-------------------------|----------------|
| `typeorm-extension`        | `src/cli/index.ts`      | `bin/cli.cjs`  |
| `typeorm-extension-esm`    | `src/cli/index.ts`      | `bin/cli.mjs`  |

Commands: `db:create`, `db:drop`, `seed:run`, `seed:create`. Each is a yargs `CommandModule` class in `src/cli/commands/`.

## Documentation

The `docs/` directory contains the VitePress site published at <https://typeorm-extension.tada5hi.net>. When changing user-facing behavior (CLI options, public API signatures, env var names, seeder/factory contract), **update the corresponding `docs/guide/*.md` page** in the same change.

```bash
npm run docs:dev           # local docs preview
npm run docs:build         # production build
```

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Source layout, the six top-level domains (`cli`, `data-source`, `database`, `env`, `errors`, `helpers`, `query`, `seeder`, `utils`), and what each owns.
- **[Architecture](.agents/architecture.md)** — Driver-dispatch pattern for `create/drop`, context-builder pipeline, data-source singleton/alias registry, query-parameter pipeline on top of `rapiq`, and seeder execution model.
- **[Testing](.agents/testing.md)** — Jest + ts-jest, SQLite-backed integration tests in `test/unit/`, fixture entities/factories/seeds in `test/data/`, and the 80% coverage gate.
- **[Conventions](.agents/conventions.md)** — `@tada5hi/eslint-config-typescript`, Conventional Commits via commitlint + husky, barrel `index.ts` per module, and the release-please release flow.

## Commits

- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Commit messages must pass `@tada5hi/commitlint-config` (Conventional Commits). The husky `commit-msg` hook enforces this.
