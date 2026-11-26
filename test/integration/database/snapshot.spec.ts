import type { DataSource } from 'typeorm';
import { Table, DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import type { SchemaSnapshot } from '../../../src';
import {
    SchemaSnapshotError,
    assertSchemaSnapshotsEqual,
    compareSchemaSnapshots,
    getSchemaSnapshot,
    runDatabaseMigrations,
} from '../../../src';
import { listUserTableNames } from '../../../src/database/schema/migration/tables';
import { GadgetBaseline1710000000003 } from '../../data/typeorm/migration-baseline/snapshot/baseline';
import { GadgetBaselineWithoutIndex1710000000003 } from '../../data/typeorm/migration-baseline/snapshot/baseline-without-index';
import { AddGadgetLabelIndex1710000000002 } from '../../data/typeorm/migration-baseline/snapshot/legacy/add-gadget-label-index';
import { CreateGadget1710000000001 } from '../../data/typeorm/migration-baseline/snapshot/legacy/create-gadget';
import { GADGET_LABEL_INDEX, GADGET_TABLE } from '../../data/typeorm/migration-baseline/snapshot/schema';
import {
    createIntegrationDataSourceOptions,
    supportsInvisibleColumns,
    supportsMigrationBaseline,
    supportsNotVisibleColumns,
    supportsSchemaSnapshot,
    supportsSnapshotSchemas,
    supportsSystemVersioning,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const LEGACY = [CreateGadget1710000000001, AddGadgetLabelIndex1710000000002];

const PROBE = 'snapshot_probe';

// the DDL of the probe cases differs by dialect family, the assertions do not
let FAMILY : 'postgres' | 'mysql' | 'mssql' | 'other' = 'other';

if (driver === 'postgres') {
    FAMILY = 'postgres';
} else if (driver === 'mysql' || driver === 'mariadb') {
    FAMILY = 'mysql';
} else if (driver === 'mssql') {
    FAMILY = 'mssql';
}

// the probe table is created by unquoted DDL, which oracle folds to upper case
const probePath = (suffix: string) => expect.stringMatching(new RegExp(`^tables\\.${PROBE}\\.${suffix.replace(/\./g, '\\.')}$`, 'i'));

// A, B and C run one after the other in the one configured database, with a full drop in between.
describe.runIf(supportsSchemaSnapshot(driver))(`src/database/schema/snapshot (${driver})`, () => {
    const created : DataSource[] = [];

    async function open(migrations: any[]) : Promise<DataSource> {
        const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([], { migrations }));

        await dataSource.initialize();
        created.push(dataSource);

        return dataSource;
    }

    // other specs leave their tables in the shared database
    async function foreignTables(dataSource: DataSource) : Promise<string[]> {
        const queryRunner = dataSource.createQueryRunner();

        try {
            const own = [GADGET_TABLE, PROBE, 'migrations'];

            return (await listUserTableNames(queryRunner))
                .filter((name) => !own.includes(name.toLowerCase()));
        } finally {
            await queryRunner.release();
        }
    }

    async function snapshot(dataSource: DataSource) : Promise<SchemaSnapshot> {
        return getSchemaSnapshot(dataSource, { ignoreTables: await foreignTables(dataSource) });
    }

    async function drop() {
        const dataSource = await open([]);
        const queryRunner = dataSource.createQueryRunner();

        try {
            try {
                // unquoted, as the probe DDL creates it
                await queryRunner.query(`DROP TABLE ${PROBE}`);
            } catch {
                // not there
            }

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
        const escape = (name: string) => dataSource.driver.escape(name);
        const rows : { name: string }[] = await dataSource.query(
            `SELECT ${escape('name')} AS ${escape('name')} FROM ${escape('migrations')} ORDER BY ${escape('id')}`,
        );

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

    // the adoption runs the baseline runner, which is verified on fewer drivers than the snapshot
    it.runIf(supportsMigrationBaseline(driver))('adoption keeps the snapshot and adds one marker', async () => {
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

    describe('reads what the probe DDL sets', () => {
        // the snapshot of a fresh probe table built by the statements
        async function probe(statements: string[]) : Promise<SchemaSnapshot> {
            await drop();

            const dataSource = await open([]);

            for (const statement of statements) {
                await dataSource.query(statement);
            }

            return snapshot(dataSource);
        }

        async function differences(expected: string[], actual: string[]) {
            return compareSchemaSnapshots(await probe(expected), await probe(actual));
        }

        it('reports a different primary key order and ignores the table column order', async () => {
            const table = (columns: string, key: string) => [
                `CREATE TABLE ${PROBE} (${columns}, CONSTRAINT pk_probe PRIMARY KEY (${key}))`,
            ];

            expect(await differences(table('a integer NOT NULL, b integer NOT NULL', 'a, b'), table('a integer NOT NULL, b integer NOT NULL', 'b, a')))
                .toEqual([expect.objectContaining({ path: probePath('primaryKey'), kind: 'changed' })]);
            expect(await differences(table('a integer NOT NULL, b integer NOT NULL', 'a, b'), table('b integer NOT NULL, a integer NOT NULL', 'a, b')))
                .toEqual([]);
        });

        it('reads unnamed constraints by their columns and reports a missing one', async () => {
            // the server names them at random on mssql and oracle
            const table = (unique: string) => [
                `CREATE TABLE ${PROBE} (a integer NOT NULL, b integer, PRIMARY KEY (a)${unique}, CHECK (a > 0))`,
            ];

            expect(await differences(table(', UNIQUE (b)'), table(', UNIQUE (b)'))).toEqual([]);

            // a unique key is a unique index on mysql and mariadb, and keeps a generated name where it is deterministic
            const missing = await differences(table(', UNIQUE (b)'), table(''));

            expect(missing).toEqual([expect.objectContaining({ path: expect.stringMatching(/\.(uniques|indices)\./), kind: 'missing' })]);
            expect((missing[0].expected as { columns: string[] }).columns.map((name) => name.toLowerCase())).toEqual(['b']);
        });

        it('reports a different index key order and direction', async () => {
            const table = (index: string) => [
                `CREATE TABLE ${PROBE} (a integer NOT NULL, b integer NOT NULL)`,
                `CREATE INDEX ix_probe ON ${PROBE} (${index})`,
            ];

            for (const index of ['b, a', 'a, b DESC']) {
                expect(await differences(table('a, b'), table(index)))
                    .toEqual([expect.objectContaining({ path: probePath('indices.ix_probe'), kind: 'changed' })]);
            }
        });

        it('reports an index expression or filter typeorm does not model', async () => {
            // what each dialect has: an expression, a filter (mssql), a prefix (mariadb)
            const index = (variant: 0 | 1) => {
                switch (driver) {
                    case 'mssql':
                        return `CREATE INDEX ix_probe ON ${PROBE} (c) WHERE c IS ${variant ? '' : 'NOT '}NULL`;
                    case 'mariadb':
                        return `CREATE INDEX ix_probe ON ${PROBE} (c(${5 + variant}))`;
                    case 'oracle':
                        return `CREATE INDEX ix_probe ON ${PROBE} (${variant ? 'UPPER' : 'LOWER'}(c))`;
                    default:
                        return `CREATE INDEX ix_probe ON ${PROBE} ((${variant ? 'upper' : 'lower'}(c)))`;
                }
            };
            const table = (variant: 0 | 1) => [`CREATE TABLE ${PROBE} (c varchar(20))`, index(variant)];

            expect(await differences(table(0), table(0))).toEqual([]);
            expect(await differences(table(0), table(1)))
                .toEqual([expect.objectContaining({ path: probePath('indices.ix_probe'), kind: 'changed' })]);
        });

        it('reads the expression of a generated column from the server', async () => {
            // typeorm reads the expression from its metadata table, where raw DDL records none
            const column = (expression: string) => {
                switch (driver) {
                    case 'mssql':
                        return `b AS (${expression})`;
                    case 'oracle':
                        return `b integer GENERATED ALWAYS AS (${expression}) VIRTUAL`;
                    default:
                        return `b integer GENERATED ALWAYS AS (${expression}) STORED`;
                }
            };
            const table = (expression: string) => [`CREATE TABLE ${PROBE} (a integer, ${column(expression)})`];

            const dataSource = await open([]);
            const queryRunner = dataSource.createQueryRunner();
            const created = !await queryRunner.hasTable('typeorm_metadata');

            if (created) {
                // the shape typeorm creates on a schema sync
                await queryRunner.createTable(new Table({
                    name: 'typeorm_metadata',
                    columns: ['type', 'database', 'schema', 'table', 'name', 'value'].map((name) => ({
                        name,
                        type: 'varchar',
                        length: name === 'value' ? '2000' : '255',
                        isNullable: name !== 'type',
                    })),
                }));
            }

            try {
                expect(await differences(table('a + 1'), table('a + 2')))
                    .toEqual([expect.objectContaining({ path: probePath('columns.b.asExpression'), kind: 'changed' })]);
            } finally {
                await drop();

                if (created) {
                    await queryRunner.dropTable('typeorm_metadata', true);
                }

                await queryRunner.release();
            }
        });

        it('reports a changed check', async () => {
            // typeorm reads no checks on mysql and mariadb
            const table = (check: string) => [`CREATE TABLE ${PROBE} (a integer, CONSTRAINT ck_probe CHECK (${check}))`];

            expect(await differences(table('a > 0'), table('a > 0'))).toEqual([]);
            expect(await differences(table('a > 0'), table('a > 1')))
                .toEqual([expect.objectContaining({ path: probePath('checks.ck_probe'), kind: 'changed' })]);
        });

        it.runIf(supportsInvisibleColumns(driver))('reports an invisible column', async () => {
            expect(await differences([`CREATE TABLE ${PROBE} (a integer, b integer INVISIBLE)`], [`CREATE TABLE ${PROBE} (a integer, b integer)`]))
                .toEqual([expect.objectContaining({ path: probePath('columns.b.options'), kind: 'changed' })]);
        });

        it.runIf(supportsSystemVersioning(driver))('reads a system versioned table and reports its versioning', async () => {
            const versioned = [`CREATE TABLE ${PROBE} (a integer) WITH SYSTEM VERSIONING`];

            expect((await probe(versioned)).tables.map((table) => table.name)).toEqual([PROBE]);
            expect(await differences(versioned, versioned)).toEqual([]);
            expect(await differences(versioned, [`CREATE TABLE ${PROBE} (a integer)`]))
                .toEqual([expect.objectContaining({ path: probePath('options'), kind: 'changed' })]);
        });

        it.runIf(supportsNotVisibleColumns(driver))('refuses a column typeorm does not read', async () => {
            await expect(probe([`CREATE TABLE ${PROBE} (a integer PRIMARY KEY, b integer NOT VISIBLE)`]))
                .rejects.toThrow(SchemaSnapshotError);
        });

        it('reports a column and a table comment', async () => {
            let commented = [
                `CREATE TABLE ${PROBE} (a integer)`,
                `COMMENT ON COLUMN ${PROBE}.a IS 'the a'`,
                `COMMENT ON TABLE ${PROBE} IS 'the probe'`,
            ];

            if (FAMILY === 'mysql') {
                commented = [`CREATE TABLE ${PROBE} (a integer COMMENT 'the a') COMMENT = 'the probe'`];
            } else if (FAMILY === 'mssql') {
                // mssql has no comment: MS_Description is the conventional extended property
                const describe = (value: string, column?: string) => 'DECLARE @s sysname = SCHEMA_NAME(); ' +
                    `EXEC sp_addextendedproperty N'MS_Description', N'${value}', N'SCHEMA', @s, N'TABLE', N'${PROBE}'${
                        column ? `, N'COLUMN', N'${column}'` : ''}`;

                commented = [`CREATE TABLE ${PROBE} (a integer)`, describe('the a', 'a'), describe('the probe')];
            }

            expect((await differences(commented, [`CREATE TABLE ${PROBE} (a integer)`])).map((d) => d.path)).toEqual([
                probePath('columns.a.comment'),
                probePath('comment'),
            ]);
        });

        it.runIf(FAMILY === 'postgres')('reports an array column', async () => {
            expect(await differences([`CREATE TABLE ${PROBE} (a integer[])`], [`CREATE TABLE ${PROBE} (a integer)`]))
                .toEqual([expect.objectContaining({ path: `tables.${PROBE}.columns.a.isArray`, kind: 'changed' })]);
        });

        it.runIf(FAMILY === 'postgres')('reports a column of another enum type', async () => {
            const typed = (name: string) => [
                `DROP TYPE IF EXISTS ${name}`,
                `CREATE TYPE ${name} AS ENUM ('x')`,
                `CREATE TABLE ${PROBE} (a ${name})`,
            ];

            try {
                expect(await differences(typed('probe_enum_a'), typed('probe_enum_b')))
                    .toEqual([expect.objectContaining({ path: `tables.${PROBE}.columns.a.enumName`, kind: 'changed' })]);
            } finally {
                await drop();

                const dataSource = await open([]);

                await dataSource.query('DROP TYPE IF EXISTS probe_enum_a');
                await dataSource.query('DROP TYPE IF EXISTS probe_enum_b');
            }
        });

        it.runIf(FAMILY === 'postgres')('reports constraint options typeorm does not model', async () => {
            const table = `CREATE TABLE ${PROBE} (a integer)`;

            expect(await differences(
                [table, `ALTER TABLE ${PROBE} ADD CONSTRAINT uq_probe UNIQUE NULLS NOT DISTINCT (a)`],
                [table, `ALTER TABLE ${PROBE} ADD CONSTRAINT uq_probe UNIQUE (a)`],
            )).toEqual([expect.objectContaining({ path: `tables.${PROBE}.uniques.uq_probe`, kind: 'changed' })]);

            expect(await differences(
                [table, `ALTER TABLE ${PROBE} ADD CONSTRAINT chk_probe CHECK (a > 0) NOT VALID`],
                [table, `ALTER TABLE ${PROBE} ADD CONSTRAINT chk_probe CHECK (a > 0)`],
            )).toEqual([expect.objectContaining({ path: `tables.${PROBE}.checks.chk_probe`, kind: 'changed' })]);
        });

        it.runIf(FAMILY === 'postgres')('reports an exclusion constraint', async () => {
            expect(await differences(
                [`CREATE TABLE ${PROBE} (r int4range, CONSTRAINT xcl_probe EXCLUDE USING gist (r WITH &&))`],
                [`CREATE TABLE ${PROBE} (r int4range)`],
            )).toEqual([expect.objectContaining({ path: `tables.${PROBE}.exclusions.xcl_probe`, kind: 'missing' })]);
        });

        it.runIf(FAMILY === 'mysql')('reports ON UPDATE of a column', async () => {
            expect(await differences(
                [`CREATE TABLE ${PROBE} (a datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6))`],
                [`CREATE TABLE ${PROBE} (a datetime(6) DEFAULT CURRENT_TIMESTAMP(6))`],
            )).toEqual([expect.objectContaining({ path: `tables.${PROBE}.columns.a.onUpdate`, kind: 'changed' })]);
        });

        it.runIf(FAMILY === 'mysql')('reports a descending index part', async () => {
            expect(await differences(
                [`CREATE TABLE ${PROBE} (a integer, INDEX ix_probe (a DESC))`],
                [`CREATE TABLE ${PROBE} (a integer, INDEX ix_probe (a))`],
            )).toEqual([expect.objectContaining({ path: `tables.${PROBE}.indices.ix_probe`, kind: 'changed' })]);
        });
    });
});

describe.runIf(supportsSnapshotSchemas(driver))(`src/database/schema/snapshot schemas (${driver})`, () => {
    const SCHEMAS = ['snapshot_a', 'snapshot_b'];

    // the same DDL per schema: a schema-local enum type and function, which postgres prints qualified
    // outside the search path, in a check, an expression index, a partial index and a foreign key
    const ddl = (schema: string) => [
        `DROP SCHEMA IF EXISTS ${schema} CASCADE`,
        `CREATE SCHEMA ${schema}`,
        `CREATE TYPE ${schema}.status AS ENUM ('a', 'b')`,
        `CREATE FUNCTION ${schema}.norm(t text) RETURNS text AS $$ SELECT lower(t) $$ LANGUAGE sql IMMUTABLE`,
        `CREATE TABLE ${schema}."Item" ("id" serial PRIMARY KEY, "Name" text NOT NULL, ` +
        `"status" ${schema}.status NOT NULL DEFAULT 'a', "parent" integer REFERENCES ${schema}."Item"("id"), ` +
        'CONSTRAINT "CHK_status" CHECK ("status" <> \'b\'))',
        `CREATE UNIQUE INDEX "IDX_norm" ON ${schema}."Item" (${schema}.norm("Name"))`,
        `CREATE INDEX "IDX_partial" ON ${schema}."Item" ("Name") WHERE "status" = 'a'::${schema}.status`,
    ];

    async function run(statements: string[]) {
        const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions());

        await dataSource.initialize();

        try {
            for (const statement of statements) {
                await dataSource.query(statement);
            }
        } finally {
            await dataSource.destroy();
        }
    }

    afterEach(async () => {
        await run(SCHEMAS.map((schema) => `DROP SCHEMA IF EXISTS ${schema} CASCADE`));
    });

    it('reads the same DDL in two schemas as equal and restores the search path', async () => {
        await run([...ddl(SCHEMAS[0]), ...ddl(SCHEMAS[1])]);

        const [a, b] = await Promise.all(SCHEMAS.map((schema) => getSchemaSnapshot(
            createIntegrationDataSourceOptions([], { schema }),
        )));

        expect(a.tables.map((table) => table.name)).toEqual(['Item']);
        expect(a.tables[0].indices.map((index) => index.name)).toEqual(['IDX_norm', 'IDX_partial']);
        expect(compareSchemaSnapshots(a, b)).toEqual([]);
        expect(a.tables[0].foreignKeys[0].definition).toBe('FOREIGN KEY (parent) REFERENCES "Item"(id)');
        expect(a.tables[0].checks[0].definition).toBe('CHECK ((status <> \'b\'::status))');

        const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions([], { schema: SCHEMAS[0] }));

        await dataSource.initialize();

        try {
            const queryRunner = dataSource.createQueryRunner();
            const [before] = await queryRunner.query('SHOW search_path');

            await getSchemaSnapshot(dataSource, { queryRunner });

            expect(await queryRunner.query('SHOW search_path')).toEqual([before]);
            await queryRunner.release();
        } finally {
            await dataSource.destroy();
        }
    });
});
