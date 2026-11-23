/* eslint-disable max-classes-per-file */
import fs from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';
import {
    afterEach, 
    describe, 
    expect, 
    it,
} from 'vitest';
import type { MigrationsInput } from '../../../../../src';
import { 
    MigrationBaseline, 
    MigrationPlanError, 
    isMigrationPlanEmpty, 
    planDatabaseMigrations, 
} from '../../../../../src';
import { AddWidgetSize1700000000004 } from '../../../../data/typeorm/migration-baseline/add-widget-size';
import { Baseline1700000000003 } from '../../../../data/typeorm/migration-baseline/baseline';
import { AddWidgetColor1700000000002 } from '../../../../data/typeorm/migration-baseline/legacy/add-widget-color';
import { CreateWidget1700000000001 } from '../../../../data/typeorm/migration-baseline/legacy/create-widget';

const directory = path.join(import.meta.dirname, '..', '..', '..', '..', '..', 'writable', 'migration-plan');

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

const LEGACY = [CreateWidget1700000000001, AddWidgetColor1700000000002];
const CURRENT = [Baseline1700000000003, AddWidgetSize1700000000004];

const names = (items: { name: string }[]) => items.map((item) => item.name);

afterEach(async () => {
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

describe('src/database/schema/migration/plan', () => {
    it('fresh: pending is baseline then later', async () => {
        const plan = await planDatabaseMigrations(dataSourceOf(databaseFile(), CURRENT));

        expect(plan.adopt).toBe(false);
        expect(plan.legacy).toEqual([]);
        expect(names(plan.pending)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
        expect(isMigrationPlanEmpty(plan)).toBe(false);
    });

    it('refuses a populated schema without history', async () => {
        const file = databaseFile();
        const ds = dataSourceOf(file, []);

        await ds.initialize();
        await ds.query('CREATE TABLE foreign_table (id integer)');
        await ds.destroy();

        const error = await planDatabaseMigrations(dataSourceOf(file, CURRENT)).catch((e) => e);

        expect(error).toBeInstanceOf(MigrationPlanError);
        expect(error.message).toContain('foreign_table');
        expect(error.message).toContain('Upgrade through the previous release first.');
    });

    it('baseline row: pending only later ones', async () => {
        const file = databaseFile();

        await runWith(file, [Baseline1700000000003]);

        const plan = await planDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(plan.adopt).toBe(false);
        expect(plan.legacy).toEqual([]);
        expect(names(plan.pending)).toEqual(['AddWidgetSize1700000000004']);
    });

    it('adopts a complete legacy chain', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        const plan = await planDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(plan.adopt).toBe(true);
        expect(plan.legacy).toEqual([]);
        expect(names(plan.pending)).toEqual(['AddWidgetSize1700000000004']);
        expect(names(plan.executed).sort()).toEqual(['AddWidgetColor1700000000002', 'CreateWidget1700000000001']);
    });

    it('runs a missing legacy tail first', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        const plan = await planDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(plan.adopt).toBe(true);
        expect(names(plan.legacy)).toEqual(['AddWidgetColor1700000000002']);
        expect(names(plan.pending)).toEqual(['AddWidgetSize1700000000004']);
    });

    it('refuses legacy rows without a declared chain', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        class NoLegacyBaseline1700000000003 extends MigrationBaseline {
            static override upgradeHint = 'Upgrade through the previous release first.';

            async up(): Promise<void> {
                // noop
            }
        }

        const error = await planDatabaseMigrations(dataSourceOf(file, [NoLegacyBaseline1700000000003])).catch((e) => e);

        expect(error).toBeInstanceOf(MigrationPlanError);
        expect(error.message).toEqual(MigrationPlanError.legacyMissing(
            'NoLegacyBaseline1700000000003',
            'Upgrade through the previous release first.',
        ).message);
        expect(error.message).toContain('Upgrade through the previous release first.');
    });

    it('plans a fresh database with a baseline without legacy', async () => {
        class NoLegacyBaseline1700000000003 extends MigrationBaseline {
            async up(): Promise<void> {
                // noop
            }
        }

        const plan = await planDatabaseMigrations(
            dataSourceOf(databaseFile(), [NoLegacyBaseline1700000000003, AddWidgetSize1700000000004]),
        );

        expect(names(plan.pending)).toEqual(['NoLegacyBaseline1700000000003', 'AddWidgetSize1700000000004']);
    });

    it('refuses legacy rows outside the declared chain', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        class OtherBaseline1700000000003 extends Baseline1700000000003 {
            static override legacy = ['test/data/typeorm/migration-baseline/legacy/create-widget.ts'];
        }

        const error = await planDatabaseMigrations(dataSourceOf(file, [OtherBaseline1700000000003])).catch((e) => e);

        expect(error.message).toContain('AddWidgetColor1700000000002');
        expect(error.message).toContain('Upgrade through the previous release first.');
    });

    it('refuses unknown rows while adopting', async () => {
        const file = databaseFile();

        await runWith(file, LEGACY);

        const ds = dataSourceOf(file, []);

        await ds.initialize();
        await ds.query('INSERT INTO migrations (timestamp, name) VALUES (1600000000000, \'Mystery1600000000000\')');
        await ds.destroy();

        const error = await planDatabaseMigrations(dataSourceOf(file, CURRENT)).catch((e) => e);

        expect(error).toBeInstanceOf(MigrationPlanError);
        expect(error.message).toContain('Mystery1600000000000');
        expect(error.message).toContain('Upgrade through the previous release first.');
    });

    it('ignores unknown rows next to a baseline row', async () => {
        const file = databaseFile();

        await runWith(file, [Baseline1700000000003]);

        const ds = dataSourceOf(file, []);

        await ds.initialize();
        await ds.query('INSERT INTO migrations (timestamp, name) VALUES (1600000000000, \'Mystery1600000000000\')');
        await ds.destroy();

        const plan = await planDatabaseMigrations(dataSourceOf(file, CURRENT));

        expect(names(plan.pending)).toEqual(['AddWidgetSize1700000000004']);
    });

    it('no baseline: pending equals typeorm\'s getPendingMigrations', async () => {
        const file = databaseFile();

        await runWith(file, [CreateWidget1700000000001]);

        const dataSource = dataSourceOf(file, LEGACY);
        const plan = await planDatabaseMigrations(dataSource);

        const { MigrationExecutor } = await import('typeorm');
        const expected = await new MigrationExecutor(dataSource, dataSource.createQueryRunner()).getPendingMigrations();

        expect(plan.adopt).toBe(false);
        expect(names(plan.pending)).toEqual(names(expected));
        expect(names(plan.pending)).toEqual(['AddWidgetColor1700000000002']);
    });

    it('no baseline: ignores the empty-schema guard', async () => {
        const file = databaseFile();
        const ds = dataSourceOf(file, []);

        await ds.initialize();
        await ds.query('CREATE TABLE foreign_table (id integer)');
        await ds.destroy();

        const plan = await planDatabaseMigrations(dataSourceOf(file, LEGACY));

        expect(names(plan.pending)).toEqual(['CreateWidget1700000000001', 'AddWidgetColor1700000000002']);
    });

    it('creates no migrations table', async () => {
        const dataSource = dataSourceOf(databaseFile(), CURRENT);

        await planDatabaseMigrations(dataSource);

        const queryRunner = dataSource.createQueryRunner();

        expect(await queryRunner.hasTable('migrations')).toBe(false);
        await queryRunner.release();
    });

    it('ignoreTables excludes a foreign table', async () => {
        const file = databaseFile();
        const ds = dataSourceOf(file, []);

        await ds.initialize();
        await ds.query('CREATE TABLE foreign_table (id integer)');
        await ds.destroy();

        const plan = await planDatabaseMigrations(dataSourceOf(file, CURRENT), { ignoreTables: ['foreign_table'] });

        expect(names(plan.pending)).toEqual(['Baseline1700000000003', 'AddWidgetSize1700000000004']);
    });

    it('uses a given query runner and does not release it', async () => {
        const dataSource = dataSourceOf(databaseFile(), CURRENT);

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        await planDatabaseMigrations(dataSource, { queryRunner });

        expect(queryRunner.isReleased).toBe(false);
        await queryRunner.release();
    });

    it('is empty when everything ran', async () => {
        const file = databaseFile();

        await runWith(file, CURRENT);

        expect(isMigrationPlanEmpty(await planDatabaseMigrations(dataSourceOf(file, CURRENT)))).toBe(true);
    });
});

