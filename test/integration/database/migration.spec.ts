/* eslint-disable max-classes-per-file */
import type { DataSource } from 'typeorm';
import {
    Column,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    DataSource as TypeORMDataSource,
} from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { generateMigration } from '../../../src';
import {
    createIntegrationDataSourceOptions,
    supportsSearchPathOption,
    supportsSearchSchema,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const TABLE = 'migration_qualifier';
const INDEX = 'IDX_migration_qualifier_name';
const TENANT_SCHEMA = 'migration_tenant';

@Entity({ name: TABLE })
class WithIndex {
    @PrimaryGeneratedColumn()
    id: number;

    @Index(INDEX)
    @Column({ type: 'varchar', length: 64 })
    name: string;
}

@Entity({ name: TABLE })
class WithoutIndex {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 64 })
    name: string;
}

/**
 * Pull the sql out of the generated `await queryRunner.query(`...`);` lines.
 */
function extractQueries(statements: string[]) : string[] {
    return statements.map((statement) => {
        const match = statement.match(/^await queryRunner\.query\(`([\s\S]*)`\);$/);

        if (!match) {
            throw new Error(`Unexpected statement: ${statement}`);
        }

        return match[1];
    });
}

async function createDataSource(entities: any[], override: Record<string, any> = {}) : Promise<DataSource> {
    const dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions(entities, override));

    await dataSource.initialize();

    return dataSource;
}

async function resetTable(dataSource: DataSource) {
    const queryRunner = dataSource.createQueryRunner();

    try {
        await queryRunner.dropTable(TABLE, true, true, true);
    } finally {
        await queryRunner.release();
    }

    await dataSource.synchronize(false);
}

describe.runIf(supportsSearchSchema(driver))(`src/database/utils/migration (${driver})`, () => {
    let dataSource : DataSource;
    let schema : string;

    beforeAll(async () => {
        dataSource = await createDataSource([WithIndex]);
        await resetTable(dataSource);
        await dataSource.destroy();

        // the generator compares the entities without the index against the table which has it
        dataSource = await createDataSource([WithoutIndex]);
        schema = (dataSource.driver as { searchSchema?: string }).searchSchema as string;
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should know the default schema', () => {
        expect(typeof schema).toEqual('string');
        expect(schema.length).toBeGreaterThan(0);
    });

    it('should leave the default schema unqualified', async () => {
        const output = await generateMigration({
            dataSource,
            preview: true,
            schemaQualified: false,
        });

        const statements = [...output.up, ...output.down];

        expect(statements.join('\n')).toContain(INDEX);

        for (const statement of statements) {
            expect(statement).not.toContain(`"${schema}".`);
        }
    });

    it('should run the unqualified statements', async () => {
        const output = await generateMigration({
            dataSource,
            preview: true,
            schemaQualified: false,
        });

        const queryRunner = dataSource.createQueryRunner();

        try {
            for (const query of extractQueries(output.up)) {
                await queryRunner.query(query);
            }

            expect((await queryRunner.getTable(TABLE))?.indices.map((index) => index.name)).not.toContain(INDEX);

            for (const query of extractQueries(output.down)) {
                await queryRunner.query(query);
            }

            expect((await queryRunner.getTable(TABLE))?.indices.map((index) => index.name)).toContain(INDEX);
        } finally {
            await queryRunner.release();
        }
    });

    describe.runIf(supportsSearchPathOption(driver))('in another schema', () => {
        let tenant : DataSource;

        beforeAll(async () => {
            await dataSource.query(`DROP SCHEMA IF EXISTS "${TENANT_SCHEMA}" CASCADE`);
            await dataSource.query(`CREATE SCHEMA "${TENANT_SCHEMA}"`);

            tenant = await createDataSource([WithIndex], { extra: { options: `-c search_path=${TENANT_SCHEMA}` } });
            await tenant.synchronize(false);
        });

        afterAll(async () => {
            if (tenant && tenant.isInitialized) {
                await tenant.destroy();
            }

            await dataSource.query(`DROP SCHEMA IF EXISTS "${TENANT_SCHEMA}" CASCADE`);
        });

        it('should run a migration generated against the default schema', async () => {
            const output = await generateMigration({
                dataSource,
                preview: true,
                schemaQualified: false,
            });

            const indexNames = async () => {
                const rows : { indexname: string }[] = await tenant.query(
                    'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2',
                    [TENANT_SCHEMA, TABLE],
                );

                return rows.map((row) => row.indexname);
            };

            expect(await indexNames()).toContain(INDEX);

            for (const query of extractQueries(output.up)) {
                await tenant.query(query);
            }

            expect(await indexNames()).not.toContain(INDEX);

            for (const query of extractQueries(output.down)) {
                await tenant.query(query);
            }

            expect(await indexNames()).toContain(INDEX);
        });

        it('should miss the other schema with the qualified statements', async () => {
            const output = await generateMigration({
                dataSource,
                preview: true,
            });

            const [drop] = extractQueries(output.up).filter((query) => query.startsWith('DROP INDEX'));

            expect(drop).toContain(`"${schema}".`);

            // the qualifier points the statement at the default schema, not at the search path
            await tenant.query(drop);

            try {
                const rows : { schemaname: string }[] = await tenant.query(
                    'SELECT schemaname FROM pg_indexes WHERE indexname = $1',
                    [INDEX],
                );

                expect(rows.map((row) => row.schemaname)).toEqual([TENANT_SCHEMA]);
            } finally {
                for (const query of extractQueries(output.down)) {
                    await dataSource.query(query);
                }
            }
        });
    });
});
