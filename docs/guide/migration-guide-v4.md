# Upgrading to v4

This is the migration guide for upgrading from **v3** to **v4**. v4 modernizes the toolchain (ESM-only, Node ≥ 22, new bundler / test runner / linter); the typeorm peer-dep bump to `^1.0.0` is a separate follow-up release once typeorm 1.0 ships.

## Breaking Changes

### Package is ESM-only

`typeorm-extension` no longer publishes a CommonJS build. Consumers must use Node ≥ 22 (which supports `require(esm)` for legacy CJS code paths).

| | v3 | v4 |
|---|---|---|
| `main` | `dist/index.cjs` | `dist/index.mjs` |
| `module` | `dist/index.mjs` | — |
| `types` | `dist/index.d.ts` | `dist/index.d.mts` |

### Single CLI binary

The dual binary scheme is gone. There is now one binary, `typeorm-extension`, backed by `bin/cli.mjs`.

| v3 | v4 |
|---|---|
| `typeorm-extension` → `bin/cli.cjs` | `typeorm-extension` → `bin/cli.mjs` |
| `typeorm-extension-esm` → `bin/cli.mjs` | _removed_ |

Update any `package.json` scripts:

```diff
- "db:create": "ts-node ./node_modules/typeorm-extension/bin/cli.cjs db:create"
+ "db:create": "tsx ./node_modules/typeorm-extension/bin/cli.mjs db:create"
```

You can use any TypeScript-aware loader (`tsx`, Node's `--experimental-strip-types`, `bun`, …) — `ts-node` is no longer recommended because its ESM mode requires extra setup.

### Minimum Node.js version

| v3 | v4 |
|---|---|
| `^20.19.0 \|\| ^22.13.0 \|\| ^23.5.0 \|\| >=24.0.0` | `>=22.0.0` |

### Peer dependency: TypeORM

`peerDependencies.typeorm` is still `~0.3.0` in this release — typeorm 1.0 hasn't shipped yet. v4 is the **toolchain-modernization** half of the v3 → v4 jump; the peer-dep bump to `^1.0.0` will land in a follow-up release once typeorm 1.0 is stable. No TypeORM API changes are required by this v4 upgrade itself.

## Internal Toolchain (no consumer impact)

For contributors only:

- Bundler: Rollup + swc → **[tsdown](https://tsdown.dev)** (rolldown + oxc)
- Test runner: Jest + ts-jest → **Vitest 4** with `unplugin-swc`
- Linter: ESLint 8 + `@tada5hi/eslint-config-typescript` → **ESLint 10** flat config + `@tada5hi/eslint-config` v2
- Publish action: `workspaces-publish` → **[`tada5hi/monoship@v2`](https://github.com/tada5hi/monoship)**
- Husky 9 hooks now in v9 format (no shebang, no `_/husky.sh` source)
- TypeScript 5 → **TypeScript 6**
