import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import type { SeederOptions } from '../../../src';
import { SeederExecutor, resetEnv } from '../../../src';

const SEEDS_DEFAULT = ['src/database/seeds/**/*{.ts,.js}'];
const FACTORIES_DEFAULT = ['src/database/factories/**/*{.ts,.js}'];

function createExecutor(dataSourceOptions?: SeederOptions) {
    const options : DataSourceOptions & SeederOptions = {
        type: 'better-sqlite3',
        database: ':memory:',
        ...(dataSourceOptions || {}),
    };

    return new SeederExecutor(new DataSource(options), { preserveFilePaths: true });
}

async function buildOptions(executor: SeederExecutor, input: SeederOptions = {}) : Promise<SeederOptions> {
    return (executor as any).buildOptions(input);
}

describe('src/seeder/config.ts', () => {
    afterEach(() => {
        delete process.env.DB_SEEDS;
        delete process.env.DB_FACTORIES;

        resetEnv();
    });

    describe('seeds', () => {
        it('should prefer input over data-source options and env', async () => {
            process.env.DB_SEEDS = 'env/seeds/*.ts';
            const executor = createExecutor({ seeds: ['ds/seeds/*.ts'] });

            const output = await buildOptions(executor, { seeds: ['input/seeds/*.ts'] });
            expect(output.seeds).toEqual(['input/seeds/*.ts']);
        });

        it('should fall back to data-source options when input is empty', async () => {
            process.env.DB_SEEDS = 'env/seeds/*.ts';
            const executor = createExecutor({ seeds: ['ds/seeds/*.ts'] });

            let output = await buildOptions(executor);
            expect(output.seeds).toEqual(['ds/seeds/*.ts']);

            output = await buildOptions(executor, { seeds: [] });
            expect(output.seeds).toEqual(['ds/seeds/*.ts']);
        });

        it('should fall back to env when input and data-source options are empty', async () => {
            process.env.DB_SEEDS = 'env/seeds/*.ts';
            const executor = createExecutor();

            const output = await buildOptions(executor);
            expect(output.seeds).toEqual(['env/seeds/*.ts']);
        });

        it('should apply the built-in default last', async () => {
            const executor = createExecutor();

            const output = await buildOptions(executor);
            expect(output.seeds).toEqual(SEEDS_DEFAULT);
        });
    });

    describe('factories', () => {
        it('should prefer input over data-source options and env', async () => {
            process.env.DB_FACTORIES = 'env/factories/*.ts';
            const executor = createExecutor({ factories: ['ds/factories/*.ts'] });

            const output = await buildOptions(executor, { factories: ['input/factories/*.ts'] });
            expect(output.factories).toEqual(['input/factories/*.ts']);
        });

        it('should fall back to data-source options when input is empty', async () => {
            process.env.DB_FACTORIES = 'env/factories/*.ts';
            const executor = createExecutor({ factories: ['ds/factories/*.ts'] });

            const output = await buildOptions(executor);
            expect(output.factories).toEqual(['ds/factories/*.ts']);
        });

        it('should fall back to env when input and data-source options are empty', async () => {
            process.env.DB_FACTORIES = 'env/factories/*.ts';
            const executor = createExecutor();

            const output = await buildOptions(executor);
            expect(output.factories).toEqual(['env/factories/*.ts']);
        });

        it('should apply the built-in default last', async () => {
            const executor = createExecutor();

            const output = await buildOptions(executor);
            expect(output.factories).toEqual(FACTORIES_DEFAULT);
        });
    });

    describe('seedName', () => {
        it('should only be taken from input', async () => {
            const executor = createExecutor({ seedName: 'FromDataSourceOptions' });

            let output = await buildOptions(executor);
            expect(output.seedName).toBeUndefined();

            output = await buildOptions(executor, { seedName: 'FromInput' });
            expect(output.seedName).toEqual('FromInput');
        });
    });

    describe('seedTracking', () => {
        it('should prefer input over data-source options', async () => {
            const executor = createExecutor({ seedTracking: true });

            const output = await buildOptions(executor, { seedTracking: false });
            expect(output.seedTracking).toBe(false);
        });

        // characterization: the data-source options fallback is dead code —
        // buildOptions defaults the input value to `false` before checking it.
        it('should ignore data-source options when input is undefined (current behavior)', async () => {
            const executor = createExecutor({ seedTracking: true });

            const output = await buildOptions(executor);
            expect(output.seedTracking).toBe(false);
        });

        it('should default to false', async () => {
            const executor = createExecutor();

            const output = await buildOptions(executor);
            expect(output.seedTracking).toBe(false);
        });
    });

    describe('seedTableName', () => {
        // characterization: the executor resolves the table name in its constructor,
        // exclusively from the data-source options — input is silently ignored.
        it('should ignore input and only honor data-source options (current behavior)', async () => {
            let executor = createExecutor({ seedTableName: 'custom_seed_table' });
            expect((executor as any).tableName).toEqual('custom_seed_table');

            executor = createExecutor();
            const output = await buildOptions(executor, { seedTableName: 'custom_seed_table' });
            expect(output.seedTableName).toEqual('custom_seed_table');
            expect((executor as any).tableName).toEqual('seeds');
        });
    });
});
