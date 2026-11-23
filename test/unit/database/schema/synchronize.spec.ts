import fs from 'node:fs';
import path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import {
    afterEach, 
    describe, 
    expect, 
    it,
} from 'vitest';
import type { MigrationsInput } from '../../../../src';
import * as lib from '../../../../src';
import { createDatabase, synchronizeDatabaseSchema } from '../../../../src';
import { AddWidgetSize1700000000004 } from '../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../data/typeorm/migration-baseline/legacy/create-widget';
import { createDataSource, createDataSourceOptions } from '../../../data/typeorm/factory';

describe('src/database/schema/synchronize', () => {
    it('should synchronize the schema of a data source instance', async () => {
        const dataSource = createDataSource();

        try {
            const migrations = await synchronizeDatabaseSchema(dataSource);

            expect(migrations).toEqual([]);
            expect(dataSource.isInitialized).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should synchronize the schema from data source options', async () => {
        const migrations = await synchronizeDatabaseSchema(createDataSourceOptions());

        expect(migrations).toEqual([]);
    });
});

describe('src/database/schema/synchronize with baselines', () => {
    const directory = path.join(import.meta.dirname, '..', '..', '..', '..', 'writable', 'synchronize-baseline');
    const files: string[] = [];

    function databaseFile(): string {
        fs.mkdirSync(directory, { recursive: true });

        const file = path.join(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

        files.push(file);

        return file;
    }

    function optionsOf(database: string, migrations: MigrationsInput): DataSourceOptions {
        return {
            type: 'better-sqlite3',
            database,
            migrations,
        };
    }

    async function readNames(database: string): Promise<string[]> {
        const dataSource = new DataSource(optionsOf(database, []));

        await dataSource.initialize();

        const rows = await dataSource.query('SELECT name FROM migrations ORDER BY id');

        await dataSource.destroy();

        return rows.map((row: { name: string }) => row.name);
    }

    async function seedLegacy(database: string) {
        const dataSource = new DataSource(optionsOf(database, [CreateWidget1700000000001, AddWidgetColor1700000000002]));

        await dataSource.initialize();
        await dataSource.runMigrations();
        await dataSource.destroy();
    }

    afterEach(() => {
        for (const file of files.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

    it('synchronizes with a discovered baseline (fresh)', async () => {
        const file = databaseFile();

        const executed = await synchronizeDatabaseSchema(optionsOf(file, CURRENT));

        expect(executed.map((item) => item.name)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(await readNames(file)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
    });

    it('adopts through synchronizeDatabaseSchema', async () => {
        const file = databaseFile();

        await seedLegacy(file);

        const executed = await synchronizeDatabaseSchema(optionsOf(file, CURRENT), { lock: false });

        expect(executed.map((item) => item.name)).toEqual(['AddWidgetSize1700000000004']);
        expect(await readNames(file)).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
    });

    it('createDatabase({ synchronize: true }) adopts', async () => {
        const file = databaseFile();

        await seedLegacy(file);

        await createDatabase({
            options: optionsOf(file, CURRENT),
            ifNotExist: true,
            synchronize: true,
        });

        expect(await readNames(file)).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
    });
});

describe('export surface', () => {
    it('exposes the migration runner', () => {
        for (const name of [
            'MigrationBaseline',
            'isMigrationBaselineClass',
            'planDatabaseMigrations',
            'isMigrationPlanEmpty',
            'runDatabaseMigrations',
            'undoDatabaseMigration',
            'MIGRATION_LOCK_NAME',
            'MigrationPlanError',
        ]) {
            expect(lib).toHaveProperty(name);
        }

        expect(lib).not.toHaveProperty('RunMigrationExecutor');
        expect(lib).not.toHaveProperty('withMigrationRunner');
        expect(lib).not.toHaveProperty('withTransaction');
    });
});
