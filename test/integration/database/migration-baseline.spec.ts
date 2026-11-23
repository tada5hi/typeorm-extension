import type { DataSource } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    MigrationPlanError,
    runDatabaseMigrations,
    undoDatabaseMigration,
} from '../../../src';
import { AddWidgetSize1700000000004 } from '../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../data/typeorm/migration-baseline/legacy/create-widget';
import {
    createIntegrationDataSourceOptions,
    supportsDatabaseLock,
    supportsMigrationBaseline,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const LEGACY = [CreateWidget1700000000001, AddWidgetColor1700000000002];
const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

describe.runIf(supportsMigrationBaseline(driver))(`src/database/schema/migration (${driver})`, () => {
    let created : DataSource[];

    async function open(migrations: any[]) : Promise<DataSource> {
        const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([], { migrations }));

        await dataSource.initialize();
        created.push(dataSource);

        return dataSource;
    }

    async function drop() {
        const dataSource = await open([]);
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.dropTable('widget', true);
            await queryRunner.dropTable('migrations', true);
        } finally {
            await queryRunner.release();
        }
    }

    async function names(dataSource: DataSource) : Promise<string[]> {
        const rows = await dataSource.query('SELECT name FROM migrations ORDER BY id');

        return rows.map((row: { name: string }) => row.name);
    }

    async function columns(dataSource: DataSource) : Promise<string[]> {
        const table = await dataSource.createQueryRunner().getTable('widget');

        return (table?.columns ?? []).map((column) => column.name).sort();
    }

    beforeAll(() => {
        created = [];
    });

    beforeEach(async () => {
        await drop();
    });

    afterEach(async () => {
        await drop();

        for (const dataSource of created.splice(0)) {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
        }
    });

    afterAll(async () => {
        for (const dataSource of created.splice(0)) {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
        }
    });

    it('fresh install then later migration', async () => {
        const first = await open([Baseline1700000000003]);

        await runDatabaseMigrations(first);

        expect(await names(first)).toEqual(['Baseline1700000000003']);
        expect(await columns(first)).toEqual(['color', 'id']);

        const second = await open(CURRENT);

        await runDatabaseMigrations(second);

        expect(await names(second)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(await columns(second)).toEqual(['color', 'id', 'size']);
    });

    it('adopts a database migrated by the plain typeorm runner', async () => {
        const legacy = await open(LEGACY);

        await legacy.runMigrations();

        const dataSource = await open(CURRENT);

        await runDatabaseMigrations(dataSource);

        expect(await names(dataSource)).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
        expect(await columns(dataSource)).toEqual(['color', 'id', 'size']);
    });

    it('older runner finds nothing pending after adoption', async () => {
        const legacy = await open(LEGACY);

        await legacy.runMigrations();

        await runDatabaseMigrations(await open(CURRENT));

        const before = await columns(await open([]));

        const older = await open(LEGACY);

        expect(await older.runMigrations()).toEqual([]);
        expect(await columns(older)).toEqual(before);
    });

    it.runIf(supportsDatabaseLock(driver))('concurrent runs adopt once', async () => {
        const legacy = await open(LEGACY);

        await legacy.runMigrations();

        const a = await open(CURRENT);
        const b = await open(CURRENT);

        await Promise.all([runDatabaseMigrations(a), runDatabaseMigrations(b)]);

        const rows = await names(a);

        expect(rows.filter((name) => name === 'Baseline1700000000003')).toHaveLength(1);
        expect(rows).toHaveLength(4);
        expect(new Set(rows).size).toEqual(4);
        expect(await columns(a)).toEqual(['color', 'id', 'size']);
    });

    it('refuses a populated schema without history', async () => {
        const dataSource = await open(CURRENT);

        await dataSource.query('CREATE TABLE widget (id INTEGER PRIMARY KEY)');

        await expect(runDatabaseMigrations(dataSource)).rejects.toBeInstanceOf(MigrationPlanError);
        await expect(runDatabaseMigrations(dataSource)).rejects.toThrow(/widget/);
    });

    it('undo stops at the baseline', async () => {
        const dataSource = await open(CURRENT);

        await runDatabaseMigrations(dataSource);

        const reverted = await undoDatabaseMigration(dataSource);

        expect(reverted?.name).toEqual('AddWidgetSize1700000000004');
        expect(await names(dataSource)).toEqual(['Baseline1700000000003']);

        await expect(undoDatabaseMigration(dataSource)).rejects.toBeInstanceOf(MigrationPlanError);
        expect(await names(dataSource)).toEqual(['Baseline1700000000003']);
    });
});
