import { runSeeder, runSeeders, useDataSource } from '../../../src';
import type { SeederEntity } from '../../../src/seeder/entity';
import { SeederExecutor } from '../../../src/seeder/executor';
import { User } from '../../data/entity/user';
import { destroyTestDatabase, setupTestDatabase } from '../../data/typeorm/utils';
import '../../data/factory/user';
import UserSeeder from '../../data/seed/user';

describe('src/seeder/index.ts', () => {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await destroyTestDatabase();
    });

    it('should seed with data-source options', async () => {
        const dataSource = await useDataSource();

        const executor = new SeederExecutor(dataSource);
        let output = await executor.execute();
        expect(output.length).toEqual(1);

        output = await executor.execute();
        expect(output.length).toEqual(0);

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definitions', async () => {
        const dataSource = await useDataSource();

        await runSeeders(dataSource, {
            seeds: [UserSeeder],
        });

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definition', async () => {
        const dataSource = await useDataSource();

        const response = await runSeeder(dataSource, UserSeeder);
        expect(response).toBeDefined();

        const { result } = (response as SeederEntity);
        expect(Array.isArray(result)).toBeTruthy();
        if (Array.isArray(result)) {
            expect(result.length).toEqual(6);
        }
        expect((result as Record<string, any>[])[0].foo).toEqual('bar');

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });
});
