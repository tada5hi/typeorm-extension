import type { DataSource } from 'typeorm';
import {
    SeederExecutor,
    runSeeder,
    runSeeders,
} from '../../../src';
import type { SeederEntity } from '../../../src';
import { User } from '../../data/entity/user';
import { destroyTestFsDataSource, setupFsDataSource } from '../../data/typeorm/utils';
import '../../data/factory/user';
import UserSeeder from '../../data/seed/user';

describe('src/seeder/index.ts', () => {
    let dataSource : DataSource;

    beforeEach(async () => {
        dataSource = await setupFsDataSource('seeder');
    });

    afterEach(async () => {
        await destroyTestFsDataSource(dataSource);
    });

    it('should seed with data-source options', async () => {
        const executor = new SeederExecutor(dataSource);
        let output = await executor.execute();
        expect(output.length).toEqual(2);

        output = await executor.execute();
        expect(output.length).toEqual(0);

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definitions', async () => {
        await runSeeders(dataSource, {
            seeds: [UserSeeder],
        });

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definition', async () => {
        const response = await runSeeder(dataSource, UserSeeder);
        expect(response).toBeDefined();

        const { result } = (response as SeederEntity);
        expect(Array.isArray(result)).toBeTruthy();
        if (Array.isArray(result)) {
            expect(result.length).toEqual(6);
        }

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });
});
