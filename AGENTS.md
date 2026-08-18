<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# typeorm-extension — Agent Guide

A TypeScript library that extends [TypeORM](https://typeorm.io) with:

- `create` / `drop` databases across all supported drivers (Postgres, MySQL/MariaDB, MongoDB, MSSQL, Oracle, better-sqlite3, CockroachDB). Note: TypeORM 1.0 removed the legacy `sqlite` driver — use `better-sqlite3`.
- A schema-drift assertion (`getSchemaDrift` / `assertSchemaMatchesMetadata`) plus guarded, idempotent rename/alter helpers for repair migrations.
- A seeder/factory system (similar to Laravel). The factory callback brings its own data generator; the library ships none.
- Entity runtime helpers (`getEntityName`, `getEntityMetadata`, `getEntityPropertyNames`, `validateEntityJoinColumns`, `isEntityUnique`) for downstream CRUD layers.
- A data-source registry with auto-discovery and lazy initialization.
- A CLI (`typeorm-extension`) wrapping the above for use in npm scripts.

The former JSON:API-style query submodule (`applyQuery`, ...) was removed in v4 in favor of [`@rapiq/adapter-typeorm`](https://github.com/tada5hi/rapiq/tree/master/packages/adapter-typeorm) (see the [migration guide](https://rapiq.tada5hi.net/guide/migration-typeorm-extension)). The README's Query section still promotes the successor with examples during the v4 cycle; it is scheduled for removal in v5.

Published to npm as `typeorm-extension`. `typeorm` is the only peer dependency. `@faker-js/faker` is a devDependency used by the fixtures and the docs examples; it is not required by consumers.

## Quick Reference

```bash
# Setup
npm install

# Development
npm run build              # build:types && build:js (typecheck then bundle)
npm run build:types        # tsc --noEmit (typecheck only, covers src/ and test/)
npm run build:js           # tsdown — builds dist/ (library) and bin/ (CLI)
npm test                   # vitest --config test/vitest.config.ts --run
npm run test:coverage      # vitest with coverage (80% thresholds enforced)
npm run test:integration   # driver suites — needs a real server, skips itself without TYPEORM_CONNECTION
npm run lint               # eslint (flat config)
npm run lint:fix
npm run docs:dev           # vitepress dev server for docs/
```

- **Node.js**: `>=22.0.0` (relies on `require(esm)` so CJS consumers still work despite ESM-only output)
- **Package manager**: npm
- **Package type**: ESM-only (`"type": "module"` in package.json)
- **Build orchestration**: [tsdown](https://tsdown.dev) (rolldown + oxc) — single tool emits `.mjs` bundle + `.d.mts` declarations
- **Test transform**: vitest with [`unplugin-swc`](https://github.com/unplugin/unplugin-swc) so TypeORM decorator metadata is emitted

### CLI Entry Points

| Binary                     | Source                  | Output         |
|----------------------------|-------------------------|----------------|
| `typeorm-extension`        | `src/cli/index.ts`      | `bin/cli.mjs`  |

Commands: `db create`, `db drift`, `db drop`, `seed run`, `seed create` (each is a [citty](https://github.com/unjs/citty) `defineCommand` factory in `src/cli/commands/`). The legacy colon-form names (`db:create`, `db:drop`, `seed:run`, `seed:create`) are still registered as backwards-compatibility aliases at the top level so consumer scripts from v3 keep working (`db drift` is v4+ only and has no colon-form alias).

## Documentation

The `docs/` directory contains the VitePress site published at <https://typeorm-extension.tada5hi.net>. When changing user-facing behavior (CLI options, public API signatures, env var names, seeder/factory contract), **update the corresponding `docs/guide/*.md` page** in the same change.

```bash
npm run docs:dev           # local docs preview
npm run docs:build         # production build
```

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Source layout, the top-level domains (`cli`, `data-source`, `database`, `env`, `errors`, `helpers`, `runtime`, `seeder`, `utils`), and what each owns.
- **[Architecture](.agents/architecture.md)** — Dialect core + connection-port adapters for `create/drop` (pure SQL dialects, native clients behind ports, one registry dispatch), context-builder pipeline, data-source singleton/alias registry, and seeder execution model.
- **[Testing](.agents/testing.md)** — Vitest + `unplugin-swc` (for decorator metadata), SQLite-backed integration tests in `test/unit/`, fixture entities/factories/seeds in `test/data/`, and the 80% coverage gate.
- **[Conventions](.agents/conventions.md)** — `@tada5hi/eslint-config` v2 (ESLint v10 flat config), Conventional Commits via commitlint + husky, barrel `index.ts` per module, and the release-please + monoship release flow.

## Documentation Sync Rule

**After any code change, update both sets of documentation in the same change:**

1. **Agent docs** — `AGENTS.md` and `.agents/*.md` (structure, architecture, testing, conventions).
2. **VitePress / user docs** — `README.MD` and `docs/guide/*.md` (published to https://typeorm-extension.tada5hi.net).

If a change touches public API signatures, CLI flags, env vars, install/setup instructions, build output, or any user-visible behaviour, `grep -rn` the README and `docs/guide/` for old behaviour and update every match. Stale docs are worse than no docs.

`CHANGELOG.md` is managed by release-please — do not edit manually.

## Commits, Issues & Pull Requests

- Commits follow **[Conventional Commits](https://www.conventionalcommits.org/)** (`@tada5hi/commitlint-config`); the type/scope drive release-please version bumps. See [conventions.md](.agents/conventions.md#commit-convention).
- Versioning, `CHANGELOG.md`, `package.json` version, and `.release-please-manifest.json` are owned by **release-please** — do not hand-edit them.
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.
