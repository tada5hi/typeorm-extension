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
npm run build              # build:types && build:js (typecheck then bundle)
npm run build:types        # tsc --noEmit (typecheck only)
npm run build:js           # tsdown — builds dist/ (library) and bin/ (CLI)
npm test                   # vitest --config test/vitest.config.ts --run
npm run test:coverage      # vitest with coverage (80% thresholds enforced)
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

Commands: `db:create`, `db:drop`, `seed:run`, `seed:create`. Each is a yargs `CommandModule` class in `src/cli/commands/`.

## Documentation

The `docs/` directory contains the VitePress site published at <https://typeorm-extension.tada5hi.net>. When changing user-facing behavior (CLI options, public API signatures, env var names, seeder/factory contract), **update the corresponding `docs/guide/*.md` page** in the same change.

```bash
npm run docs:dev           # local docs preview
npm run docs:build         # production build
```

## Detailed Guides

- **[Project Structure](.agents/structure.md)** — Source layout, the top-level domains (`cli`, `data-source`, `database`, `env`, `errors`, `helpers`, `query`, `seeder`, `utils`), and what each owns.
- **[Architecture](.agents/architecture.md)** — Driver-dispatch pattern for `create/drop`, context-builder pipeline, data-source singleton/alias registry, query-parameter pipeline on top of `rapiq`, and seeder execution model.
- **[Testing](.agents/testing.md)** — Vitest + `unplugin-swc` (for decorator metadata), SQLite-backed integration tests in `test/unit/`, fixture entities/factories/seeds in `test/data/`, and the 80% coverage gate.
- **[Conventions](.agents/conventions.md)** — `@tada5hi/eslint-config` v2 (ESLint v10 flat config), Conventional Commits via commitlint + husky, barrel `index.ts` per module, and the release-please + monoship release flow.

## Documentation Sync Rule

**After any code change, update both sets of documentation in the same change:**

1. **Agent docs** — `AGENTS.md` and `.agents/*.md` (structure, architecture, testing, conventions).
2. **VitePress / user docs** — `README.MD` and `docs/guide/*.md` (published to https://typeorm-extension.tada5hi.net).

If a change touches public API signatures, CLI flags, env vars, install/setup instructions, build output, or any user-visible behaviour, `grep -rn` the README and `docs/guide/` for old behaviour and update every match. Stale docs are worse than no docs.

`CHANGELOG.md` is managed by release-please — do not edit manually.

## Commits

- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Commit messages must pass `@tada5hi/commitlint-config` (Conventional Commits). The husky `commit-msg` hook enforces this.
- For breaking changes (API removal, ESM-only, CLI binary changes, peer dep major bumps), mark the commit with `!` (e.g. `feat!: …`) and include a `BREAKING CHANGE:` footer so release-please bumps the major version.
