import type { DataSource } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import type { SchemaSnapshot } from '../../../src';
import {
    assertSchemaSnapshotsEqual,
    compareSchemaSnapshots,
    getSchemaSnapshot,
    runDatabaseMigrations,
} from '../../../src';
import { GadgetBaseline1710000000003 } from '../../data/typeorm/migration-baseline/snapshot/baseline';
import { GadgetBaselineWithoutIndex1710000000003 } from '../../data/typeorm/migration-baseline/snapshot/baseline-without-index';
import { AddGadgetLabelIndex1710000000002 } from '../../data/typeorm/migration-baseline/snapshot/legacy/add-gadget-label-index';
import { CreateGadget1710000000001 } from '../../data/typeorm/migration-baseline/snapshot/legacy/create-gadget';
import { GADGET_LABEL_INDEX, GADGET_TABLE } from '../../data/typeorm/migration-baseline/snapshot/schema';
import {
    createIntegrationDataSourceOptions,
    supportsMigrationBaseline,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const LEGACY = [CreateGadget1710000000001, AddGadgetLabelIndex1710000000002];

// A, B and C run one after the other in the one configured database, with a full drop in between.
describe.runIf(supportsMigrationBaseline(driver))(`src/database/schema/snapshot (${driver})`, () => {
    const created : DataSource[] = [];

    async function open(migrations: any[]) : Promise<DataSource> {
        const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([], { migrations }));

        await dataSource.initialize();
        created.push(dataSource);

        return dataSource;
    }

    // other specs leave their tables in the shared database
    async function foreignTables(dataSource: DataSource) : Promise<string[]> {
        const sql = driver === 'mysql' || driver === 'mariadb' ?
            'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()' :
            'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = current_schema()';
        const rows : { name?: string, NAME?: string }[] = await dataSource.query(sql);

        return rows
            .map((row) => (row.name ?? row.NAME) as string)
            .filter((name) => name !== GADGET_TABLE && name !== 'migrations');
    }

    async function snapshot(dataSource: DataSource) : Promise<SchemaSnapshot> {
        return getSchemaSnapshot(dataSource, { ignoreTables: await foreignTables(dataSource) });
    }

    async function drop() {
        const dataSource = await open([]);
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.dropTable(GADGET_TABLE, true);
            await queryRunner.dropTable('migrations', true);
        } finally {
            await queryRunner.release();
        }
    }

    async function destroy() {
        for (const dataSource of created.splice(0)) {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
        }
    }

    async function names(dataSource: DataSource) : Promise<string[]> {
        const rows : { name: string }[] = await dataSource.query('SELECT name FROM migrations ORDER BY id');

        return rows.map((row) => row.name);
    }

    // database A: the legacy chain, run by the plain typeorm runner
    async function chain() : Promise<SchemaSnapshot> {
        const dataSource = await open(LEGACY);

        await dataSource.runMigrations();

        return snapshot(dataSource);
    }

    // database B: a fresh install from a baseline
    async function install(baseline: any) : Promise<SchemaSnapshot> {
        const dataSource = await open([baseline]);

        await runDatabaseMigrations(dataSource, { ignoreTables: await foreignTables(dataSource) });

        return snapshot(dataSource);
    }

    beforeEach(async () => {
        await drop();
    });

    afterEach(async () => {
        await drop();
        await destroy();
    });

    it('chain and baseline produce equal snapshots', async () => {
        const expected = await chain();

        expect(expected.tables.map((table) => table.name)).toEqual([GADGET_TABLE]);
        expect(expected.tables[0].indices.map((index) => index.name)).toEqual([GADGET_LABEL_INDEX]);

        await drop();

        const actual = await install(GadgetBaseline1710000000003);

        expect(compareSchemaSnapshots(expected, actual)).toEqual([]);
        expect(() => assertSchemaSnapshotsEqual(expected, actual)).not.toThrow();
    });

    it('reports an expression index missing from the baseline', async () => {
        const expected = await chain();

        await drop();

        const actual = await install(GadgetBaselineWithoutIndex1710000000003);
        const differences = compareSchemaSnapshots(expected, actual);

        expect(differences).toHaveLength(1);
        expect(differences[0]).toMatchObject({
            path: `tables.${GADGET_TABLE}.indices.${GADGET_LABEL_INDEX}`,
            kind: 'missing',
        });
    });

    it('adoption keeps the snapshot and adds one marker', async () => {
        const expected = await chain();

        await drop();

        // database C: the chain, then the runner adopts the baseline
        const legacy = await open(LEGACY);

        await legacy.runMigrations();

        const dataSource = await open([GadgetBaseline1710000000003]);

        await runDatabaseMigrations(dataSource, { ignoreTables: await foreignTables(dataSource) });

        assertSchemaSnapshotsEqual(expected, await snapshot(dataSource));
        expect(await names(dataSource)).toEqual([
            'CreateGadget1710000000001',
            'AddGadgetLabelIndex1710000000002',
            'GadgetBaseline1710000000003',
        ]);
    });
});
