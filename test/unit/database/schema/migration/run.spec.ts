/* eslint-disable max-classes-per-file */
import fs from 'node:fs';
import path from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DataSource, ForbiddenTransactionModeOverrideError, TableColumn } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import type { MigrationsInput } from '../../../../../src';
import {
    MIGRATION_LOCK_NAME,
    MigrationBaseline,
    runDatabaseMigrations,
} from '../../../../../src';
import { withDatabaseLock } from '../../../../../src/database/lock/module';
import type * as LockModule from '../../../../../src/database/lock/module';
import { AddWidgetSize1700000000004 } from '../../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../../data/typeorm/migration-baseline/legacy/create-widget';

vi.mock('../../../../../src/database/lock/module', async (importOriginal) => {
    const original = await importOriginal<typeof LockModule>();

    return {
        ...original,
        withDatabaseLock: vi.fn(original.withDatabaseLock),
    };
});

const directory = path.join(import.meta.dirname, '..', '..', '..', '..', '..', 'writable', 'migration-run');

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

type Row = {
    id: number, 
    timestamp: number, 
    name: string 
};

async function readRows(database: string): Promise<Row[]> {
    const dataSource = dataSourceOf(database, []);

    await dataSource.initialize();

    const rows = await dataSource.query('SELECT id, timestamp, name FROM migrations ORDER BY id');

    await dataSource.destroy();

    return rows.map((row: Row) => ({
        id: Number(row.id), 
        timestamp: Number(row.timestamp), 
        name: row.name, 
    }));
}

async function readColumns(database: string, table: string): Promise<string[]> {
    const dataSource = dataSourceOf(database, []);

    await dataSource.initialize();

    const columns = await dataSource.query(`PRAGMA table_info(${table})`);

    await dataSource.destroy();

    return columns.map((column: { name: string }) => column.name);
}

const LEGACY = [CreateWidget1700000000001, AddWidgetColor1700000000002];
const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

const names = (items: { name: string }[]) => items.map((item) => item.name);

let flakyFailed = false;

class FlakyAddColor1700000000002 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('widget', new TableColumn({
            name: 'color',
            type: 'varchar',
            isNullable: true,
        }));

        if (flakyFailed) {
            return;
        }

        flakyFailed = true;

        throw new Error('flaky legacy migration');
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('widget', 'color');
    }
}

class FlakyBaseline1700000000003 extends MigrationBaseline {
    static override legacy = [CreateWidget1700000000001, FlakyAddColor1700000000002];

    async up(queryRunner: QueryRunner): Promise<void> {
        await new Baseline1700000000003().up(queryRunner);
    }
}

class FailingPending1700000000004 implements MigrationInterface {
    async up(): Promise<void> {
        throw new Error('failing pending migration');
    }

    async down(): Promise<void> {
        // noop
    }
}

class OverridingPending1700000000004 extends AddWidgetSize1700000000004 {
    transaction = false;
}

afterEach(async () => {
    vi.mocked(withDatabaseLock).mockClear();

    while (created.length > 0) {
        const dataSource = created.pop()!;

        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }

    while (files.length > 0) {
        fs.rmSync(files.pop()!, { force: true });
    }
});

describe('src/database/schema/migration/run', () => {
    it('fresh: runs baseline then later, rows match', async () => {
        const file = databaseFile();

        const executed = await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(names(executed)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(names(await readRows(file))).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(await readColumns(file, 'widget')).toEqual(['id', 'color', 'size']);
    });

    it('adopts: inserts the marker, keeps every legacy row', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        const executed = await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(names(executed)).toEqual(['AddWidgetSize1700000000004']);
        expect(names(await readRows(file))).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
        expect(await readColumns(file, 'widget')).toEqual(['id', 'color', 'size']);
    });

    it('adopts after running the legacy tail', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        const executed = await runDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(names(executed)).toEqual(['AddWidgetColor1700000000002', 'AddWidgetSize1700000000004']);
        expect(names(await readRows(file))).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
        expect(await readColumns(file, 'widget')).toEqual(['id', 'color', 'size']);
    });

    it('resumes after a failing legacy migration', async () => {
        const file = databaseFile();
        const migrations = [FlakyBaseline1700000000003, AddWidgetSize1700000000004];

        flakyFailed = false;

        await runWith(file, [CreateWidget1700000000001]);

        await expect(runDatabaseMigrations(dataSourceOf(file, migrations))).rejects.toThrow('flaky legacy migration');

        expect(names(await readRows(file))).toEqual(['CreateWidget1700000000001']);
        expect(await readColumns(file, 'widget')).toEqual(['id']);

        const executed = await runDatabaseMigrations(dataSourceOf(file, migrations));

        expect(names(executed)).toEqual(['FlakyAddColor1700000000002', 'AddWidgetSize1700000000004']);

        const rows = names(await readRows(file));

        expect(rows).toEqual([
            'CreateWidget1700000000001',
            'FlakyAddColor1700000000002',
            'FlakyBaseline1700000000003',
            'AddWidgetSize1700000000004',
        ]);
        expect(rows.filter((name) => name === 'FlakyBaseline1700000000003')).toHaveLength(1);
    });

    it('all: a failing pending migration keeps the adoption', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        await expect(runDatabaseMigrations(
            dataSourceOf(file, [Baseline1700000000003, FailingPending1700000000004]),
            { transaction: 'all' },
        )).rejects.toThrow('failing pending migration');

        expect(names(await readRows(file))).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
            'Baseline1700000000003',
        ]);
    });

    it('all: refuses a per-migration transaction override', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        const error = await runDatabaseMigrations(
            dataSourceOf(file, [Baseline1700000000003, OverridingPending1700000000004]),
            { transaction: 'all' },
        ).catch((e) => e);

        expect(error).toBeInstanceOf(ForbiddenTransactionModeOverrideError);
        expect(names(await readRows(file))).toEqual([
            'CreateWidget1700000000001',
            'AddWidgetColor1700000000002',
        ]);
    });

    it('no baseline: same result and rows as dataSource.runMigrations', async () => {
        const ours = databaseFile();
        const theirs = databaseFile();
        const migrations = [...LEGACY, AddWidgetSize1700000000004];

        await runWith(ours, [CreateWidget1700000000001]);
        await runWith(theirs, [CreateWidget1700000000001]);

        const executed = await runDatabaseMigrations(dataSourceOf(ours, migrations));

        const reference = dataSourceOf(theirs, migrations);

        await reference.initialize();

        const expected = await reference.runMigrations();

        await reference.destroy();

        expect(names(executed)).toEqual(names(expected));
        expect(names(executed)).toEqual(['AddWidgetColor1700000000002', 'AddWidgetSize1700000000004']);
        expect(await readRows(ours)).toEqual(await readRows(theirs));
        expect(await readColumns(ours, 'widget')).toEqual(await readColumns(theirs, 'widget'));
    });

    it('lock false runs without a lock', async () => {
        const first = databaseFile();

        await runDatabaseMigrations(dataSourceOf(first, CURRENT));

        expect(withDatabaseLock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(withDatabaseLock).mock.calls[0]![1]).toEqual(MIGRATION_LOCK_NAME);

        vi.mocked(withDatabaseLock).mockClear();

        const second = databaseFile();
        const executed = await runDatabaseMigrations(dataSourceOf(second, CURRENT), { lock: false });

        expect(withDatabaseLock).not.toHaveBeenCalled();
        expect(names(executed)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
    });

    it('uses the caller\'s query runner and does not release it', async () => {
        const dataSource = dataSourceOf(databaseFile(), CURRENT);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const createQueryRunner = vi.spyOn(dataSource, 'createQueryRunner');

        const executed = await runDatabaseMigrations(dataSource, { queryRunner });

        expect(names(executed)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(createQueryRunner).not.toHaveBeenCalled();
        expect(withDatabaseLock).not.toHaveBeenCalled();
        expect(queryRunner.isReleased).toBe(false);

        await queryRunner.release();
    });
});
