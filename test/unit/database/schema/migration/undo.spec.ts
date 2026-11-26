import fs from 'node:fs';
import path from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import type { MigrationsInput } from '../../../../../src';
import { MigrationPlanError, runDatabaseMigrations, undoDatabaseMigration } from '../../../../../src';
import { AddWidgetSize1700000000004 } from '../../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../../data/typeorm/migration-baseline/legacy/create-widget';

const directory = path.join(import.meta.dirname, '..', '..', '..', '..', '..', 'writable', 'migration-undo');

const created: DataSource[] = [];
const files: string[] = [];

function databaseFile(): string {
    fs.mkdirSync(directory, { recursive: true });

    const file = path.join(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);

    files.push(file);

    return file;
}

function dataSourceOf(database: string, migrations: MigrationsInput): DataSource {
    const dataSource = new DataSource({
        type: 'better-sqlite3',
        database,
        migrations,
    });

    created.push(dataSource);

    return dataSource;
}

async function runWith(database: string, migrations: MigrationsInput) {
    const dataSource = dataSourceOf(database, migrations);

    await dataSource.initialize();
    await dataSource.runMigrations();
    await dataSource.destroy();
}

async function query<T>(database: string, sql: string): Promise<T[]> {
    const dataSource = dataSourceOf(database, []);

    await dataSource.initialize();

    const rows = await dataSource.query(sql);

    await dataSource.destroy();

    return rows;
}

async function readNames(database: string): Promise<string[]> {
    const rows = await query<{ name: string }>(database, 'SELECT name FROM migrations ORDER BY id');

    return rows.map((row) => row.name);
}

async function readColumns(database: string, table: string): Promise<string[]> {
    const columns = await query<{ name: string }>(database, `PRAGMA table_info(${table})`);

    return columns.map((column) => column.name);
}

class OptOut1700000000004 extends AddWidgetSize1700000000004 implements MigrationInterface {
    transaction = false;
}

const LEGACY = [CreateWidget1700000000001, AddWidgetColor1700000000002];
const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

afterEach(async () => {
    vi.restoreAllMocks();

    for (const dataSource of created.splice(0)) {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }

    for (const file of files.splice(0)) {
        fs.rmSync(file, { force: true });
    }
});

describe('undoDatabaseMigration', () => {
    it('reverts the newest post-baseline migration', async () => {
        const file = databaseFile();

        await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        const reverted = await undoDatabaseMigration(dataSourceOf(file, CURRENT));

        expect(reverted?.name).toEqual('AddWidgetSize1700000000004');
        expect(await readNames(file)).toEqual(['Baseline1700000000003']);
        expect(await readColumns(file, 'widget')).toEqual(['id', 'color']);
    });

    it('refuses at the baseline before any down() runs', async () => {
        const file = databaseFile();

        await runDatabaseMigrations(dataSourceOf(file, CURRENT));
        await undoDatabaseMigration(dataSourceOf(file, CURRENT));

        const down = vi.spyOn(Baseline1700000000003.prototype, 'down');

        await expect(undoDatabaseMigration(dataSourceOf(file, CURRENT)))
            .rejects.toThrow(MigrationPlanError.baselineIrreversible('Baseline1700000000003').message);

        expect(down).not.toHaveBeenCalled();
        expect(await readNames(file)).toEqual(['Baseline1700000000003']);
    });

    it('refuses when only legacy rows remain below the marker', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);
        await runDatabaseMigrations(dataSourceOf(file, CURRENT));
        await query(file, 'DELETE FROM migrations WHERE name IN (\'Baseline1700000000003\', \'AddWidgetSize1700000000004\')');

        const down = vi.spyOn(AddWidgetColor1700000000002.prototype, 'down');

        await expect(undoDatabaseMigration(dataSourceOf(file, CURRENT)))
            .rejects.toThrow(MigrationPlanError);

        expect(down).not.toHaveBeenCalled();
        expect(await readNames(file)).toEqual(['CreateWidget1700000000001', 'AddWidgetColor1700000000002']);
    });

    it.each(['all', 'each', 'none'] as const)('no baseline: same as dataSource.undoLastMigration (%s)', async (transaction) => {
        const migrations = [CreateWidget1700000000001, AddWidgetColor1700000000002];
        const expected = databaseFile();
        const actual = databaseFile();

        await runWith(expected, migrations);
        await runWith(actual, migrations);

        const reference = dataSourceOf(expected, migrations);

        await reference.initialize();
        await reference.undoLastMigration({ transaction });

        const reverted = await undoDatabaseMigration(dataSourceOf(actual, migrations), { transaction });

        expect(reverted?.name).toEqual('AddWidgetColor1700000000002');
        expect(await readNames(actual)).toEqual(await readNames(expected));
        expect(await readColumns(actual, 'widget')).toEqual(await readColumns(expected, 'widget'));
    });

    it('nothing executed: resolves undefined and creates nothing', async () => {
        const file = databaseFile();

        expect(await undoDatabaseMigration(dataSourceOf(file, CURRENT))).toBeUndefined();

        const tables = await query<{ name: string }>(file, 'SELECT name FROM sqlite_master WHERE type = \'table\'');

        expect(tables).toEqual([]);
    });

    it('runs the hooks around down() under none', async () => {
        const file = databaseFile();

        await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        const dataSource = dataSourceOf(file, CURRENT);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const before = vi.spyOn(queryRunner, 'beforeMigration');
        const after = vi.spyOn(queryRunner, 'afterMigration');

        await undoDatabaseMigration(dataSource, { queryRunner, transaction: 'none' });

        expect(before).toHaveBeenCalledTimes(1);
        expect(after).toHaveBeenCalledTimes(1);

        await queryRunner.release();
    });

    it('reverts inside a transaction under all even when the migration opts out', async () => {
        const file = databaseFile();
        const migrations = [Baseline1700000000003, OptOut1700000000004];

        await runDatabaseMigrations(dataSourceOf(file, migrations), { transaction: 'each' });

        const dataSource = dataSourceOf(file, migrations);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const start = vi.spyOn(queryRunner, 'startTransaction');

        const reverted = await undoDatabaseMigration(dataSource, { queryRunner, transaction: 'all' });

        expect(reverted?.name).toEqual('OptOut1700000000004');
        expect(start).toHaveBeenCalledTimes(1);

        await queryRunner.release();
    });

    it('uses a given query runner without releasing it or taking the lock', async () => {
        const file = databaseFile();

        await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        const dataSource = dataSourceOf(file, CURRENT);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const release = vi.spyOn(queryRunner, 'release');
        const create = vi.spyOn(dataSource, 'createQueryRunner');

        await undoDatabaseMigration(dataSource, { queryRunner });

        expect(release).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(queryRunner.isReleased).toBe(false);

        await queryRunner.release();
    });
});
