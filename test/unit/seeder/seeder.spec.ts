import {runSeeder, runSeeders, runSeederWithResponse, useDataSource} from "../../../src";
import {User} from "../../data/entity/user";
import {destroyTestDatabase, setupTestDatabase} from "../../data/typeorm/utils";
import '../../data/factory/user';
import UserSeeder from "../../data/seed/user";

describe('src/seeder/index.ts', function () {
    beforeEach(async () => {
        await setupTestDatabase();
    });

    afterEach(async () => {
        await destroyTestDatabase();
    });

    it('should seed with data-source options', async () => {
        const dataSource = await useDataSource();

        await runSeeders(dataSource);
        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definitions', async () => {
        const dataSource = await useDataSource();

        await runSeeders(dataSource, {
            seeds: [UserSeeder]
        });

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    });

    it('should seed with explicit definition', async () => {
        const dataSource = await useDataSource();

        await runSeeder(dataSource, UserSeeder);

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
    })

    it('should seed with explicit definition', async () => {
        const dataSource = await useDataSource();

        const resp = await runSeederWithResponse(dataSource, UserSeeder);

        const repository = dataSource.getRepository(User);
        const entities = await repository.find();

        expect(entities).toBeDefined();
        expect(entities.length).toBeGreaterThanOrEqual(7);
        expect(resp.length).toBeGreaterThanOrEqual(6);
    })
});
