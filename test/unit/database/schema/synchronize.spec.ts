import fs from 'node:fs';
import path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import type { MigrationsInput } from '../../../../src';
import * as lib from '../../../../src';
import { MigrationPlanError, createDatabase, synchronizeDatabaseSchema } from '../../../../src';
import { AddWidgetSize1700000000004 } from '../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../data/typeorm/migration-baseline/legacy/create-widget';
import { createDataSource, createDataSourceOptions } from '../../../data/typeorm/factory';
import { MIGRATION_LOCK_NAME } from '../../../../src/database/schema/migration';
import type * as LockModule from '../../../../src/database/lock/module';
import { withDatabaseLock } from '../../../../src/database/lock/module';

vi.mock('../../../../src/database/lock/module', async (importOriginal) => {
    const original = await importOriginal<typeof LockModule>();

    return {
        ...original,
        withDatabaseLock: vi.fn(original.withDatabaseLock),
    };
});

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

        try {
            const rows = await dataSource.query('SELECT name FROM migrations ORDER BY id');

            return rows.map((row: { name: string }) => row.name);
        } finally {
            await dataSource.destroy();
        }
    }

    async function readTables(database: string): Promise<string[]> {
        const dataSource = new DataSource(optionsOf(database, []));

        await dataSource.initialize();

        try {
            const rows = await dataSource.query('SELECT name FROM sqlite_master WHERE type = \'table\' ORDER BY name');

            return rows.map((row: { name: string }) => row.name);
        } finally {
            await dataSource.destroy();
        }
    }

    async function seedLegacy(database: string) {
        const dataSource = new DataSource(optionsOf(database, [CreateWidget1700000000001, AddWidgetColor1700000000002]));

        await dataSource.initialize();

        try {
            await dataSource.runMigrations();
        } finally {
            await dataSource.destroy();
        }
    }

    async function seedForeignTable(database: string) {
        const seed = new DataSource(optionsOf(database, []));

        await seed.initialize();

        try {
            await seed.query('CREATE TABLE foreign_table (id integer)');
        } finally {
            await seed.destroy();
        }
    }

    afterEach(() => {
        vi.mocked(withDatabaseLock).mockClear();

        for (const file of files.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

    it('takes no lock by default', async () => {
        await synchronizeDatabaseSchema(optionsOf(databaseFile(), CURRENT));

        expect(withDatabaseLock).not.toHaveBeenCalled();
    });

    it('takes MIGRATION_LOCK_NAME with lock: true', async () => {
        await synchronizeDatabaseSchema(optionsOf(databaseFile(), CURRENT), { lock: true });

        expect(withDatabaseLock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(withDatabaseLock).mock.calls[0]![1]).toEqual(MIGRATION_LOCK_NAME);
    });

    it('takes the named lock with lock: string', async () => {
        await synchronizeDatabaseSchema(optionsOf(databaseFile(), CURRENT), { lock: 'custom' });

        expect(withDatabaseLock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(withDatabaseLock).mock.calls[0]![1]).toEqual('custom');
    });

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

    it('adopts through an uninitialized instance with migrationsRun, bypassing typeorm\'s runner', async () => {
        const file = databaseFile();

        await seedLegacy(file);

        const dataSource = new DataSource({ ...optionsOf(file, CURRENT), migrationsRun: true });

        try {
            const executed = await synchronizeDatabaseSchema(dataSource, { lock: false });

            expect(executed.map((item) => item.name)).toEqual(['AddWidgetSize1700000000004']);
        } finally {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
        }

        expect(await readNames(file)).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
    });

    it.each(['synchronize', 'dropSchema'] as const)('refuses %s on a baseline project before initializing (options)', async (flag) => {
        const file = databaseFile();

        await seedForeignTable(file);

        const error = await synchronizeDatabaseSchema({ ...optionsOf(file, CURRENT), [flag]: true }).catch((e) => e);

        expect(error).toBeInstanceOf(MigrationPlanError);
        expect(error.names).toEqual([flag]);
        expect(await readTables(file)).toEqual(['foreign_table']);
    });

    it.each(['synchronize', 'dropSchema'] as const)('refuses %s on a baseline project before initializing (instance)', async (flag) => {
        const file = databaseFile();

        await seedForeignTable(file);

        const dataSource = new DataSource({ ...optionsOf(file, CURRENT), [flag]: true });
        const error = await synchronizeDatabaseSchema(dataSource).catch((e) => e);

        expect(error).toBeInstanceOf(MigrationPlanError);
        expect(dataSource.isInitialized).toBe(false);
        expect(await readTables(file)).toEqual(['foreign_table']);
    });

    it('still initializes with synchronize on a project without a baseline', async () => {
        const file = databaseFile();

        const executed = await synchronizeDatabaseSchema({
            ...optionsOf(file, [CreateWidget1700000000001]),
            synchronize: true,
        });

        expect(executed.map((item) => item.name)).toEqual(['CreateWidget1700000000001']);
    });

    it('destroys its own data source when the runner refuses', async () => {
        const file = databaseFile();

        await seedForeignTable(file);

        const initialize = vi.spyOn(DataSource.prototype, 'initialize');
        const destroy = vi.spyOn(DataSource.prototype, 'destroy');

        try {
            const error = await synchronizeDatabaseSchema(optionsOf(file, CURRENT)).catch((e) => e);

            expect(error).toBeInstanceOf(MigrationPlanError);

            const owned = initialize.mock.contexts[0] as DataSource;

            expect(owned.isInitialized).toBe(false);
            expect(destroy.mock.contexts).toContain(owned);
        } finally {
            initialize.mockRestore();
            destroy.mockRestore();
        }
    });

    it('passes ignoreTables to the runner', async () => {
        const file = databaseFile();

        await seedForeignTable(file);

        const executed = await synchronizeDatabaseSchema(optionsOf(file, CURRENT), { ignoreTables: ['foreign_table'] });

        expect(executed.map((item) => item.name)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
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
        expect(lib).not.toHaveProperty('listUserTableNames');
        expect(lib).not.toHaveProperty('buildUserTablesStatement');
        expect(lib).not.toHaveProperty('scanMigrationSource');
        expect(lib).not.toHaveProperty('useMigrationDataSource');
    });
});
