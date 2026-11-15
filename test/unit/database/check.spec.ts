import type { MigrationInterface } from 'typeorm';
import { DataSource } from 'typeorm';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { checkDatabase, setDataSource } from '../../../src';
import { useRuntimeRegistry } from '../../../src/runtime';
import { createDataSource, createDataSourceOptions } from '../../data/typeorm/factory';

/**
 * typeorm refuses a migration class without a timestamp suffix
 * when it collects the pending migrations.
 */
class MigrationWithoutTimestamp implements MigrationInterface {
    async up() : Promise<void> {
        // no-op
    }

    async down() : Promise<void> {
        // no-op
    }
}

describe('src/database/methods/check', () => {
    let dataSource : DataSource | undefined;

    afterEach(async () => {
        vi.restoreAllMocks();
        useRuntimeRegistry().reset();

        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }

        dataSource = undefined;
    });

    async function registerFailingProbe(error: Error) {
        dataSource = createDataSource();
        await dataSource.initialize();

        const counter = { release: 0 };
        const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);

        dataSource.createQueryRunner = (...args) => {
            const queryRunner = createQueryRunner(...args);
            const release = queryRunner.release.bind(queryRunner);

            queryRunner.hasTable = async () => {
                throw error;
            };
            queryRunner.release = async () => {
                counter.release++;

                return release();
            };

            return queryRunner;
        };

        setDataSource(dataSource);

        return counter;
    }

    it('should report a missing database when the probe raises 3D000', async () => {
        const counter = await registerFailingProbe(
            Object.assign(new Error('database "x" does not exist'), { code: '3D000' }),
        );

        await expect(checkDatabase()).resolves.toEqual({
            exists: false,
            schema: false,
            migrationsPending: [],
        });
        expect(counter.release).toBe(1);
        expect(dataSource?.isInitialized).toBe(true);
    });

    it('should rethrow any other probe error and release the runner', async () => {
        const error = new Error('boom');
        const counter = await registerFailingProbe(error);

        await expect(checkDatabase()).rejects.toBe(error);
        expect(counter.release).toBe(1);
        expect(dataSource?.isInitialized).toBe(true);
    });

    it('should destroy an owned data source when the probe throws', async () => {
        const destroy = vi.spyOn(DataSource.prototype, 'destroy');

        await expect(checkDatabase({
            options: {
                ...createDataSourceOptions(),
                migrations: [MigrationWithoutTimestamp],
            },
        })).rejects.toThrow('Migration class name should have a JavaScript timestamp appended');
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('should report an existing database without its tables on plain options', async () => {
        // a fresh in-memory database exists, but none of the entity tables do
        const result = await checkDatabase({ options: createDataSourceOptions() });

        expect(result).toEqual({
            exists: true,
            schema: false,
            migrationsPending: [],
        });
    });
});
