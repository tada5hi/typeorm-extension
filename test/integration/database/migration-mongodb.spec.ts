import type { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import type { MongoQueryRunner } from 'typeorm/driver/mongodb/MongoQueryRunner.js';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import { isMigrationPlanEmpty, planDatabaseMigrations, runDatabaseMigrations } from '../../../src';
import { createIntegrationDataSourceOptions, useIntegrationDriver } from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const COLLECTION = 'migration_mongodb_widget';

function useDb(queryRunner: QueryRunner) {
    const { databaseConnection, connection } = queryRunner as MongoQueryRunner;

    return databaseConnection.db(connection.options.database as string);
}

class CreateMongoWidget1700000000010 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        await useDb(queryRunner).createCollection(COLLECTION);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await useDb(queryRunner).dropCollection(COLLECTION);
    }
}

describe.runIf(driver === 'mongodb')(`src/database/schema/migration (${driver})`, () => {
    let dataSource : DataSource;

    async function cleanup() {
        const queryRunner = dataSource.createQueryRunner();

        try {
            for (const name of [COLLECTION, 'migrations']) {
                // dropping a collection which does not exist is the clean state already
                await useDb(queryRunner).dropCollection(name).catch(() => undefined);
            }
        } finally {
            await queryRunner.release();
        }
    }

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(
            createIntegrationDataSourceOptions([], { migrations: [CreateMongoWidget1700000000010] }),
        );
        await dataSource.initialize();
        await cleanup();
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            try {
                await cleanup();
            } finally {
                await dataSource.destroy();
            }
        }
    });

    it('plans, runs and finds nothing left to run', async () => {
        const plan = await planDatabaseMigrations(dataSource);

        expect(isMigrationPlanEmpty(plan)).toBe(false);

        const executed = await runDatabaseMigrations(dataSource, { lock: false });

        expect(executed.map((item) => item.name)).toEqual(['CreateMongoWidget1700000000010']);

        expect(await runDatabaseMigrations(dataSource, { lock: false })).toEqual([]);
        expect(isMigrationPlanEmpty(await planDatabaseMigrations(dataSource))).toBe(true);
    });
});
