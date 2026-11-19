---
layout: page
pageClass: te-home
sidebar: false
aside: false
title: typeorm-extension
description: Create, migrate, check, lock and seed TypeORM databases on every driver, from code or the CLI.
hero:
    eyebrow:
        badge: 'v4'
        text: 'TypeORM, ready for deployment'
    title: 'Create, migrate, check.'
    highlight: 'Lock and seed.'
    description: 'TypeORM maps your entities and runs your migrations. typeorm-extension covers the rest of a deployment: the database has to exist, replicas start at once, the schema can drift from the entities, and every driver reports a duplicate key differently.'
    actions:
        - text: 'Get Started'
          link: '/guide/'
        - text: 'View on GitHub'
          link: 'https://github.com/tada5hi/typeorm-extension'
    install: 'npm install typeorm-extension typeorm'
    meta: 'MIT licensed · Node 22+ · ESM-only · TypeORM ^1.1.3'
    file: 'deploy.ts'
    code: |
        import { DataSource } from 'typeorm';
        import {
            assertSchemaMatchesMetadata,
            runSeeders,
            withDatabaseLock,
        } from 'typeorm-extension';
        import { options } from './data-source';

        // `db create` ran once in the release step
        const dataSource = new DataSource({
            ...options,
            migrationsRun: false,
            synchronize: false,
            dropSchema: false,
        });
        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        try {
            await withDatabaseLock(queryRunner, 'migrations', async () => {
                await dataSource.runMigrations();
                await assertSchemaMatchesMetadata(dataSource);
                await runSeeders(dataSource, { seedTracking: true });
            });
        } finally {
            await queryRunner.release();
        }
drivers:
    label: 'Drivers'
    items:
        - 'postgres'
        - 'cockroachdb'
        - 'mysql'
        - 'mariadb'
        - 'mssql'
        - 'oracle'
        - 'mongodb'
        - 'better-sqlite3'
features:
    eyebrow: "// what's in the box"
    title: 'The parts TypeORM leaves to you.'
    lede: 'Each one works on its own; use the ones your deployment needs.'
    items:
        - title: 'Create and drop'
          text: '`createDatabase()` speaks each dialect, skips an existing database and then runs the migrations or `synchronize()`.'
          code: 'await createDatabase({ options })'
          link: '/guide/database'
        - title: 'Schema drift'
          text: 'Fails the deploy when the migrations and the entities describe different schemas, and lists the statements that would reconcile them.'
          code: 'npx typeorm-extension db drift'
          link: '/guide/schema'
        - title: 'Repair migrations'
          text: '`renameIndex`, `renameForeignKey` and `changeColumnType` read the current state first and return `false` when already applied.'
          code: 'renameIndex(queryRunner, { table, from, to })'
          link: '/guide/schema#repair-migrations'
        - title: 'Locks'
          text: 'A named advisory lock for one replica at a time, and a row read with a write lock inside a transaction.'
          code: "withDatabaseLock(queryRunner, 'migrations', fn)"
          link: '/guide/locks'
        - title: 'Error classification'
          text: 'Recognize a unique or foreign key violation and a lock conflict, whichever driver raised it.'
          code: 'if (isDatabaseUniqueViolationError(e)) { … }'
          link: '/guide/errors'
        - title: 'Seeding'
          text: 'Seeder classes and factories, run by `seed run`, optionally tracked so each seeder runs once.'
          code: 'await factoryManager.get(User).saveMany(5)'
          link: '/guide/seeding'
compare:
    eyebrow: '// why'
    title: 'What you stop writing.'
    lede: 'The same deployment concerns, without and with typeorm-extension.'
    columns:
        concern: 'Concern'
        without: 'Without it'
        with: 'With it'
    rows:
        - concern: 'The database exists'
          without: 'Connect to a server-level database and run each dialect''s own `CREATE DATABASE`.'
          with: '`createDatabase()` or `db create`. Skips an existing database.'
        - concern: 'Several replicas migrate'
          without: 'Each replica runs the migrations at boot, or you hand-roll `pg_advisory_lock` / `GET_LOCK`.'
          with: '`withDatabaseLock()`: one session at a time, released also when the callback throws.'
        - concern: 'Migrations drift from the entities'
          without: 'Noticed when the next generated migration contains unrelated changes.'
          with: '`assertSchemaMatchesMetadata()` or `db drift` fails the deploy.'
        - concern: 'Read-modify-write races'
          without: 'Two requests read the same row, both pass the check, both write.'
          with: '`withLockedEntity()` reads the row with a write lock inside a transaction.'
        - concern: 'A failed write'
          without: 'Read `code`, `number` or `errorNum`, depending on the driver.'
          with: '`isDatabaseUniqueViolationError(e)` knows where each driver puts the code.'
        - concern: 'Development and test data'
          without: 'Ad-hoc scripts that insert rows and break on the second run.'
          with: 'Seeders and factories, tracked so each seeder runs once.'
quickstart:
    eyebrow: '// quickstart'
    title: 'From data source to seeded database'
    lede: 'Describe the data source once. The CLI finds data-source.ts in src/ and creates, checks and seeds from it.'
    active: 1
    tabs:
        - label: 'Install'
          code: |
              $ npm install typeorm-extension typeorm pg
              $ npm install --save-dev tsx
        - label: 'data-source.ts'
          code: |
              import { DataSource, DataSourceOptions } from 'typeorm';
              import { SeederOptions } from 'typeorm-extension';

              export const options: DataSourceOptions & SeederOptions = {
                  type: 'postgres',
                  database: 'app',
                  seeds: ['src/database/seeds/**/*{.ts,.js}'],
                  factories: ['src/database/factories/**/*{.ts,.js}'],
              };

              export const dataSource = new DataSource(options);
        - label: 'package.json'
          code: |
              "scripts": {
                  "db:create": "tsx ./node_modules/typeorm-extension/bin/cli.mjs db create",
                  "db:drift":  "tsx ./node_modules/typeorm-extension/bin/cli.mjs db drift",
                  "seed:run":  "tsx ./node_modules/typeorm-extension/bin/cli.mjs seed run"
              }
    link:
        text: 'Installation'
        link: '/guide/installation'
---

<script setup>
import TeHome from './.vitepress/components/home/TeHome.vue';
</script>

<TeHome />
