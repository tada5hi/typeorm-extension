/* eslint-disable max-classes-per-file */
import type { DataSource } from 'typeorm';
import type { Seeder } from '../../../src';
import { SeederExecutor, runSeeder } from '../../../src';
import { destroyTestFsDataSource, setupFsDataSource } from '../../data/typeorm/utils';
import userFactoryItem from '../../data/factory/user';
import UserSeeder from '../../data/seed/user';

class UntrackedSeeder implements Seeder {
    public async run() : Promise<unknown> {
        return 'executed';
    }
}

class TimestampSeeder1700000000000 implements Seeder {
    public async run() : Promise<unknown> {
        return undefined;
    }
}

async function findTable(dataSource: DataSource, name: string) : Promise<unknown[]> {
    return dataSource.query(
        'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = ?',
        [name],
    );
}

describe('src/seeder/executor.ts', () => {
    let dataSource : DataSource;

    beforeEach(async () => {
        dataSource = await setupFsDataSource('seeder-executor');
    });

    afterEach(async () => {
        await destroyTestFsDataSource(dataSource);
    });

    it('should honor a custom seedTableName from the options input', async () => {
        const executor = new SeederExecutor(dataSource);
        const output = await executor.execute({
            seeds: [UserSeeder],
            seedTableName: 'custom_seed_table',
        });
        expect(output.length).toEqual(1);

        expect(await findTable(dataSource, 'custom_seed_table')).toHaveLength(1);
        expect(await findTable(dataSource, 'seeds')).toHaveLength(0);

        const rows = await dataSource.query('SELECT name FROM custom_seed_table');
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toEqual('UserSeeder');
    });

    it('should honor seedTracking from the data-source options', async () => {
        Object.assign(dataSource.options, { seedTracking: true });

        const executor = new SeederExecutor(dataSource);

        let output = await executor.execute({ seeds: [UntrackedSeeder] });
        expect(output.length).toEqual(1);

        output = await executor.execute({ seeds: [UntrackedSeeder] });
        expect(output.length).toEqual(0);
    });

    it('should honor seedTracking from the options input', async () => {
        const executor = new SeederExecutor(dataSource);

        let output = await executor.execute({
            seeds: [UntrackedSeeder],
            seedTracking: true,
        });
        expect(output.length).toEqual(1);

        output = await executor.execute({
            seeds: [UntrackedSeeder],
            seedTracking: true,
        });
        expect(output.length).toEqual(0);
    });

    it('should run a single seed selected by class name', async () => {
        const entity = await runSeeder(dataSource, 'UserSeeder');

        expect(entity).toBeDefined();
        expect(entity?.name).toEqual('UserSeeder');
    });

    it('should run a single seed selected by file name', async () => {
        const executor = new SeederExecutor(dataSource, { preserveFilePaths: true });
        const output = await executor.execute({
            seeds: ['test/data/seed/{role,user}.ts'],
            seedName: 'user.ts',
        });

        expect(output.length).toEqual(1);
        expect(output[0].name).toEqual('UserSeeder');
    });

    it('should register factories provided as items', async () => {
        const executor = new SeederExecutor(dataSource);
        const output = await executor.execute({
            seeds: [UserSeeder],
            factories: [userFactoryItem],
        });

        expect(output.length).toEqual(1);
    });

    it('should derive the tracking timestamp from the class name', async () => {
        const executor = new SeederExecutor(dataSource);

        let output = await executor.execute({
            seeds: [TimestampSeeder1700000000000],
            seedTracking: true,
        });
        expect(output.length).toEqual(1);
        expect(output[0].timestamp).toEqual(1700000000000);

        output = await executor.execute({
            seeds: [TimestampSeeder1700000000000],
            seedTracking: true,
        });
        expect(output.length).toEqual(0);
    });
});
