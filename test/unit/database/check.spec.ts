import fs from 'node:fs';
import path from 'node:path';
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

    /**
     * Count the query runners the instance hands out and their releases.
     * With an error, the runner's hasTable probe throws it.
     */
    function instrument(instance: DataSource, error?: Error) {
        const counter = { createQueryRunner: 0, release: 0 };
        const createQueryRunner = instance.createQueryRunner.bind(instance);

        instance.createQueryRunner = (...args) => {
            counter.createQueryRunner++;

            const queryRunner = createQueryRunner(...args);
            const release = queryRunner.release.bind(queryRunner);

            if (error) {
                queryRunner.hasTable = async () => {
                    throw error;
                };
            }

            queryRunner.release = async () => {
                counter.release++;

                return release();
            };

            return queryRunner;
        };

        return counter;
    }

    async function registerFailingProbe(error: Error) {
        dataSource = createDataSource();
        await dataSource.initialize();

        const counter = instrument(dataSource, error);

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

    describe('passed data source', () => {
        const databasePath = path.join(
            import.meta.dirname,
            '..',
            '..',
            '..',
            'writable',
            'check-database.sqlite',
        );

        afterEach(() => {
            fs.rmSync(databasePath, { force: true });
        });

        it('should take precedence over options and stay initialized', async () => {
            dataSource = createDataSource();
            await dataSource.initialize();
            await dataSource.synchronize();

            const counter = instrument(dataSource);

            // the options branch would reject on this migration
            const result = await checkDatabase({
                dataSource,
                options: {
                    ...createDataSourceOptions(),
                    migrations: [MigrationWithoutTimestamp],
                },
            });

            expect(result).toEqual({
                exists: true,
                schema: true,
                migrationsPending: [],
            });
            // the probe and the schema builder each take a runner from the instance
            expect(counter.createQueryRunner).toBe(2);
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should not destroy it with dataSourceCleanup', async () => {
            dataSource = createDataSource();
            await dataSource.initialize();

            const counter = instrument(dataSource);

            await checkDatabase({ dataSource, dataSourceCleanup: true });

            expect(counter.createQueryRunner).toBe(1);
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should initialize and use it without synchronize', async () => {
            dataSource = createDataSource({
                ...createDataSourceOptions(),
                synchronize: false,
            });

            const counter = instrument(dataSource);

            const result = await checkDatabase({ dataSource });

            expect(result).toEqual({
                exists: true,
                schema: false,
                migrationsPending: [],
            });
            expect(counter.createQueryRunner).toBe(1);
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should check on a copy when it would synchronize', async () => {
            fs.mkdirSync(path.dirname(databasePath), { recursive: true });

            dataSource = createDataSource({
                type: 'better-sqlite3',
                entities: createDataSourceOptions().entities,
                database: databasePath,
                synchronize: true,
            });

            const counter = instrument(dataSource);

            const result = await checkDatabase({ dataSource });

            expect(result).toEqual({
                exists: true,
                schema: false,
                migrationsPending: [],
            });
            expect(counter.createQueryRunner).toBe(0);
            expect(dataSource.isInitialized).toBe(false);

            // synchronize would have created the entity tables in the file
            const inspector = new DataSource({ type: 'better-sqlite3', database: databasePath });

            await inspector.initialize();

            try {
                const tables = await inspector.query('SELECT name FROM sqlite_master WHERE type = \'table\'');

                expect(tables).toEqual([]);
            } finally {
                await inspector.destroy();
            }
        });

        it('should rethrow a probe error without destroying it', async () => {
            dataSource = createDataSource();
            await dataSource.initialize();

            const error = new Error('boom');
            const counter = instrument(dataSource, error);

            await expect(checkDatabase({ dataSource })).rejects.toBe(error);
            expect(counter.release).toBe(1);
            expect(dataSource.isInitialized).toBe(true);
        });
    });
});
