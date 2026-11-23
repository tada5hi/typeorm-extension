/* eslint-disable max-classes-per-file */
import fs from 'node:fs';
import path from 'node:path';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
    DataSource,
    ForbiddenTransactionModeOverrideError,
    MigrationExecutor,
    Table,
    TableColumn,
} from 'typeorm';
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
    planDatabaseMigrations,
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

class TransactionalPending1700000000004 extends AddWidgetSize1700000000004 {
    transaction = true;
}

/**
 * The child row survives the parent's delete only when sqlite enforces no foreign keys.
 */
class CascadeData1700000000005 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'parent',
            columns: [{
                name: 'id',
                type: 'integer',
                isPrimary: true,
            }],
        }));
        await queryRunner.createTable(new Table({
            name: 'child',
            columns: [
                {
                    name: 'id',
                    type: 'integer',
                    isPrimary: true,
                },
                {
                    name: 'parent_id',
                    type: 'integer',
                },
            ],
            foreignKeys: [{
                columnNames: ['parent_id'],
                referencedTableName: 'parent',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }],
        }));

        await queryRunner.query('INSERT INTO parent (id) VALUES (1)');
        await queryRunner.query('INSERT INTO child (id, parent_id) VALUES (1, 1)');
        await queryRunner.query('DELETE FROM parent WHERE id = 1');
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('child');
        await queryRunner.dropTable('parent');
    }
}

async function countChildren(database: string): Promise<number> {
    const dataSource = dataSourceOf(database, []);

    await dataSource.initialize();

    const rows = await dataSource.query('SELECT COUNT(*) AS count FROM child');

    await dataSource.destroy();

    return Number(rows[0].count);
}

type TransactionMode = 'all' | 'each' | 'none';

/**
 * Run on a caller's query runner and record transaction boundaries and row inserts in order.
 */
async function traceRun(database: string, migrations: MigrationsInput, transaction: TransactionMode): Promise<string[]> {
    const dataSource = dataSourceOf(database, migrations);

    await dataSource.initialize();

    const queryRunner = dataSource.createQueryRunner();
    const trace: string[] = [];

    const start = queryRunner.startTransaction.bind(queryRunner);
    const commit = queryRunner.commitTransaction.bind(queryRunner);

    queryRunner.startTransaction = async (level) => {
        trace.push('start');
        await start(level);
    };
    queryRunner.commitTransaction = async () => {
        trace.push('commit');
        await commit();
    };

    const original = MigrationExecutor.prototype.insertMigration;

    MigrationExecutor.prototype.insertMigration = async function (this: MigrationExecutor, migration) {
        trace.push(`insert:${migration.name}`);
        await original.call(this, migration);
    };

    try {
        await runDatabaseMigrations(dataSource, { queryRunner, transaction });
    } finally {
        MigrationExecutor.prototype.insertMigration = original;

        await queryRunner.release();
    }

    return trace;
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

    it.each(['all', 'each', 'none'] as const)('no baseline: same result and rows as dataSource.runMigrations (%s)', async (transaction) => {
        const ours = databaseFile();
        const theirs = databaseFile();
        const migrations = [...LEGACY, AddWidgetSize1700000000004, CascadeData1700000000005];

        await runWith(ours, [CreateWidget1700000000001]);
        await runWith(theirs, [CreateWidget1700000000001]);

        const executed = await runDatabaseMigrations(dataSourceOf(ours, migrations), { transaction });

        const reference = dataSourceOf(theirs, migrations);

        await reference.initialize();

        const expected = await reference.runMigrations({ transaction });

        await reference.destroy();

        expect(names(executed)).toEqual(names(expected));
        expect(names(executed)).toEqual([
            'AddWidgetColor1700000000002',
            'AddWidgetSize1700000000004',
            'CascadeData1700000000005',
        ]);
        expect(await readRows(ours)).toEqual(await readRows(theirs));
        expect(await readColumns(ours, 'widget')).toEqual(await readColumns(theirs, 'widget'));
        expect(await countChildren(ours)).toEqual(await countChildren(theirs));

        if (transaction === 'none') {
            // typeorm runs without a transaction with foreign keys enforced.
            expect(await countChildren(ours)).toEqual(0);
        }
    });

    it('all: legacy and marker in one transaction, pending in a second', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        expect(await traceRun(file, CURRENT, 'all')).toEqual([
            'start',
            'insert:AddWidgetColor1700000000002',
            'insert:Baseline1700000000003',
            'commit',
            'start',
            'insert:AddWidgetSize1700000000004',
            'commit',
        ]);
    });

    it('each: the marker gets its own transaction', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        expect(await traceRun(file, CURRENT, 'each')).toEqual([
            'start',
            'insert:AddWidgetColor1700000000002',
            'commit',
            'start',
            'insert:Baseline1700000000003',
            'commit',
            'start',
            'insert:AddWidgetSize1700000000004',
            'commit',
        ]);
    });

    it('none: inserts the marker without a transaction', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        expect(await traceRun(file, CURRENT, 'none')).toEqual([
            'insert:AddWidgetColor1700000000002',
            'insert:Baseline1700000000003',
            'insert:AddWidgetSize1700000000004',
        ]);
    });

    it('each: honours a per-migration override', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        expect(await traceRun(file, [Baseline1700000000003, OverridingPending1700000000004], 'each')).toEqual([
            'start',
            'insert:Baseline1700000000003',
            'commit',
            'insert:OverridingPending1700000000004',
        ]);
    });

    it('none: honours a per-migration override', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        expect(await traceRun(file, [Baseline1700000000003, TransactionalPending1700000000004], 'none')).toEqual([
            'insert:Baseline1700000000003',
            'start',
            'insert:TransactionalPending1700000000004',
            'commit',
        ]);
    });

    it('lock false runs without a lock', async () => {
        const first = databaseFile();

        await runDatabaseMigrations(dataSourceOf(first, CURRENT));

        expect(withDatabaseLock).toHaveBeenCalledTimes(1);
        expect(vi.mocked(withDatabaseLock).mock.calls[0]![1]).toEqual(MIGRATION_LOCK_NAME);
        expect(vi.mocked(withDatabaseLock).mock.calls[0]![3]).toEqual({ strict: false });

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

    it('mongodb without a baseline: plans and runs without hasTable', async () => {
        const dataSource = dataSourceOf(databaseFile(), LEGACY);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        const inserted: Record<string, unknown>[] = [];
        const stored = [{ timestamp: 1700000000001, name: 'CreateWidget1700000000001' }];
        const collection = {
            insertOne: async (values: Record<string, unknown>) => {
                inserted.push(values);
            },
        };

        // the shape of typeorm's MongoQueryRunner, as far as the migration executor reaches
        Object.assign(queryRunner, {
            hasTable: async () => {
                throw new Error('Check schema queries are not supported by MongoDB driver.');
            },
            cursor: () => ({ sort: () => ({ toArray: async () => stored }) }),
            databaseConnection: { db: () => ({ collection: () => collection }) },
        });
        (dataSource.driver.options as { type: string }).type = 'mongodb';
        vi.spyOn(dataSource.driver, 'createSchemaBuilder').mockReturnValue({} as never);

        try {
            const plan = await planDatabaseMigrations(dataSource, { queryRunner });

            expect(names(plan.pending)).toEqual(['AddWidgetColor1700000000002']);

            vi.spyOn(queryRunner, 'addColumn').mockResolvedValue(undefined);

            const executed = await runDatabaseMigrations(dataSource, { queryRunner });

            expect(names(executed)).toEqual(['AddWidgetColor1700000000002']);
            expect(inserted).toEqual([{ timestamp: 1700000000002, name: 'AddWidgetColor1700000000002' }]);
        } finally {
            (dataSource.driver.options as { type: string }).type = 'better-sqlite3';
            await queryRunner.release();
        }
    });
});
