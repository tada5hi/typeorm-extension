# Upgrading to v3

This the migration guide for upgrading from **v2** to **v3**.

## CLI

### File Path

**Old**

```shell
ts-node ./node-modules/typeorm-extension/dist/cli/index.js 
```

**New**
```shell
// CommonJS
ts-node ./node-modules/typeorm-extension/bin/cli.cjs 

// ESM
ts-node-esm ./node-modules/typeorm-extension/bin/cli.mjs
```

### General
1. The seeding command **seed** has been renamed to **seed:run**.
2. The seeding option **--seed** has been renamed to **--name**.
3. The seeding option **--root** now corresponds to the root directory of the project.
4. The **--dataSource** option now can contain the relative path and the name to the data-source.
