import type { DataSource, QueryRunner } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    isDatabaseForeignKeyViolationError,
    isDatabaseLockConflictError,
    isDatabaseUniqueViolationError,
} from '../../../src';
import { ConstraintChild } from '../../data/entity/constraint-child';
import { ConstraintDocument } from '../../data/entity/constraint-document';
import { ConstraintParent } from '../../data/entity/constraint-parent';
import {
    createIntegrationDataSourceOptions,
    supportsSchemaMetadata,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

async function capture(fn: () => Promise<unknown>) : Promise<unknown> {
    try {
        await fn();
    } catch (e) {
        return e;
    }

    throw new Error('The statement was expected to fail.');
}

function classify(error: unknown) {
    return {
        unique: isDatabaseUniqueViolationError(error),
        foreignKey: isDatabaseForeignKeyViolationError(error),
        lock: isDatabaseLockConflictError(error),
    };
}

describe.runIf(supportsSchemaMetadata(driver))(`src/database/error (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(
            createIntegrationDataSourceOptions([ConstraintParent, ConstraintChild]),
        );
        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('constraint_child', true, true, true);
            await queryRunner.dropTable('constraint_parent', true, true, true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.synchronize(false);
    });

    beforeEach(async () => {
        await dataSource.getRepository(ConstraintChild).clear();
        await dataSource.getRepository(ConstraintParent).createQueryBuilder().delete().execute();

        await dataSource.getRepository(ConstraintParent).insert([
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
        ]);
    });

    afterAll(async () => {
        if (!dataSource || !dataSource.isInitialized) {
            return;
        }

        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('constraint_child', true, true, true);
            await queryRunner.dropTable('constraint_parent', true, true, true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.destroy();
    });

    it('should classify a duplicate unique column', async () => {
        const error = await capture(() => dataSource.getRepository(ConstraintParent).insert({ id: 3, name: 'a' }));

        expect(classify(error)).toEqual({
            unique: true, 
            foreignKey: false, 
            lock: false, 
        });
    });

    it('should classify a duplicate primary key', async () => {
        const error = await capture(() => dataSource.getRepository(ConstraintParent).insert({ id: 1, name: 'c' }));

        expect(classify(error)).toEqual({
            unique: true, 
            foreignKey: false, 
            lock: false, 
        });
    });

    it('should classify a reference to a missing row', async () => {
        const error = await capture(() => dataSource.getRepository(ConstraintChild).insert({ id: 1, parentId: 99 }));

        expect(classify(error)).toEqual({
            unique: false, 
            foreignKey: true, 
            lock: false, 
        });
    });

    it('should classify the delete of a referenced row', async () => {
        await dataSource.getRepository(ConstraintChild).insert({ id: 1, parentId: 1 });

        const error = await capture(() => dataSource.getRepository(ConstraintParent).delete({ id: 1 }));

        expect(classify(error)).toEqual({
            unique: false, 
            foreignKey: true, 
            lock: false, 
        });
    });

    // cockroachdb is left out: the victim did not surface within the timeout
    // against v24.3.8, maxTransactionRetries: 0 included. Its code (40001)
    // is the postgres SQLSTATE the unit spec covers.
    it.skipIf(driver === 'cockroachdb')('should classify the victim of a deadlock', async () => {
        const runners : QueryRunner[] = [dataSource.createQueryRunner(), dataSource.createQueryRunner()];

        try {
            await Promise.all(runners.map((runner) => runner.connect()));
            await Promise.all(runners.map((runner) => runner.startTransaction()));

            await runners[0].manager.update(ConstraintParent, { id: 1 }, { name: 'a1' });
            await runners[1].manager.update(ConstraintParent, { id: 2 }, { name: 'b1' });

            // Each session now asks for the row the other one holds. The
            // database aborts one of them; rolling the victim back frees its
            // row, so the other one can finish.
            const cross = (runner: QueryRunner, id: number) => runner.manager
                .update(ConstraintParent, { id }, { name: `${id}2` })
                .catch(async (e) => {
                    // mssql has already aborted the transaction of its victim
                    await runner.rollbackTransaction().catch(() => undefined);
                    throw e;
                });

            const results = await Promise.allSettled([
                cross(runners[0], 2),
                cross(runners[1], 1),
            ]);

            const errors = results
                .filter((result) => result.status === 'rejected')
                .map((result) => (result as PromiseRejectedResult).reason);

            expect(errors.length).toBeGreaterThanOrEqual(1);
            for (const error of errors) {
                expect(classify(error)).toEqual({
                    unique: false, 
                    foreignKey: false, 
                    lock: true, 
                });
            }
        } finally {
            for (const runner of runners) {
                if (runner.isTransactionActive) {
                    await runner.rollbackTransaction().catch(() => undefined);
                }

                await runner.release();
            }
        }
    });
});

describe.runIf(driver === 'mongodb')('src/database/error (mongodb)', () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(
            createIntegrationDataSourceOptions([ConstraintDocument], { synchronize: true }),
        );
        await dataSource.initialize();
        await dataSource.getMongoRepository(ConstraintDocument).deleteMany({});
    });

    afterAll(async () => {
        if (!(dataSource && dataSource.isInitialized)) {
            return;
        }

        await dataSource.getMongoRepository(ConstraintDocument).deleteMany({});
        await dataSource.destroy();
    });

    it('should classify a duplicate key', async () => {
        const repository = dataSource.getMongoRepository(ConstraintDocument);
        await repository.insertOne({ name: 'a' });

        const error = await capture(() => repository.insertOne({ name: 'a' }));

        expect(classify(error)).toEqual({
            unique: true, 
            foreignKey: false, 
            lock: false, 
        });
    });
});
