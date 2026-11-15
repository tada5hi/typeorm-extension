import fs from 'node:fs';
import path from 'node:path';
import type { DataSourceOptions, MigrationInterface } from 'typeorm';
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

const databasePath = path.join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'writable',
    'check-database.sqlite',
);

function createFileDataSourceOptions(input: Partial<DataSourceOptions> = {}) : DataSourceOptions {
    return {
        type: 'better-sqlite3',
        entities: createDataSourceOptions().entities,
        database: databasePath,
        ...input,
    } as DataSourceOptions;
}

/**
 * Run a callback against the file database through a data source
 * of its own, which knows no entities.
 */
async function inspectFile<T>(fn: (dataSource: DataSource) => Promise<T>) : Promise<T> {
    const inspector = new DataSource({ type: 'better-sqlite3', database: databasePath });

    await inspector.initialize();

    try {
        return await fn(inspector);
    } finally {
        await inspector.destroy();
    }
}

async function readTableNames() : Promise<string[]> {
    return inspectFile(async (inspector) => {
        const rows : { name: string }[] = await inspector.query(
            'SELECT name FROM sqlite_master WHERE type = \'table\' ORDER BY name',
        );

        return rows.map((row) => row.name);
    });
}

/**
 * A table with one row, which a dropped schema would lose.
 */
async function seedFile() : Promise<void> {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    await inspectFile(async (inspector) => {
        await inspector.query('CREATE TABLE "keep" ("id" integer PRIMARY KEY)');
        await inspector.query('INSERT INTO "keep" ("id") VALUES (1)');
    });
}

async function readKeptRows() : Promise<unknown[]> {
    return inspectFile((inspector) => inspector.query('SELECT "id" FROM "keep"'));
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

        fs.rmSync(databasePath, { force: true });
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

    it('should destroy an owned data source when the check throws after initialize', async () => {
        const destroy = vi.spyOn(DataSource.prototype, 'destroy');

        await expect(checkDatabase({
            options: {
                ...createDataSourceOptions(),
                migrations: [MigrationWithoutTimestamp],
            },
        })).rejects.toThrow('Migration class name should have a JavaScript timestamp appended');
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('should destroy an owned data source when releasing the runner fails', async () => {
        const destroy = vi.spyOn(DataSource.prototype, 'destroy');
        const { createQueryRunner } = DataSource.prototype;

        vi.spyOn(DataSource.prototype, 'createQueryRunner').mockImplementation(function create(this: DataSource, mode) {
            const queryRunner = createQueryRunner.call(this, mode);

            queryRunner.release = async () => {
                throw new Error('release failed');
            };

            return queryRunner;
        });

        await expect(checkDatabase({ options: createDataSourceOptions() })).rejects.toThrow('release failed');
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

    it('should not drop the schema on options with dropSchema', async () => {
        await seedFile();

        await checkDatabase({ options: createFileDataSourceOptions({ dropSchema: true }) });

        expect(await readKeptRows()).toEqual([{ id: 1 }]);
    });

    describe('passed data source', () => {
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
            expect(counter.createQueryRunner).toBeGreaterThanOrEqual(1);
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should not destroy it with dataSourceCleanup', async () => {
            dataSource = createDataSource();
            await dataSource.initialize();

            const counter = instrument(dataSource);

            await checkDatabase({ dataSource, dataSourceCleanup: true });

            expect(counter.createQueryRunner).toBeGreaterThanOrEqual(1);
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should check an uninitialized one on a copy', async () => {
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
            expect(counter.createQueryRunner).toBe(0);
            expect(dataSource.isInitialized).toBe(false);
        });

        it('should not synchronize an uninitialized one', async () => {
            fs.mkdirSync(path.dirname(databasePath), { recursive: true });

            dataSource = createDataSource(createFileDataSourceOptions({ synchronize: true }));

            const result = await checkDatabase({ dataSource });

            expect(result).toEqual({
                exists: true,
                schema: false,
                migrationsPending: [],
            });
            expect(dataSource.isInitialized).toBe(false);
            // synchronize would have created the entity tables in the file
            expect(await readTableNames()).toEqual([]);
        });

        it('should not drop the schema of an uninitialized one', async () => {
            await seedFile();

            dataSource = createDataSource(createFileDataSourceOptions({ dropSchema: true }));

            await checkDatabase({ dataSource });

            expect(dataSource.isInitialized).toBe(false);
            expect(await readKeptRows()).toEqual([{ id: 1 }]);
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

    describe('registered data source', () => {
        it('should not initialize an uninitialized one', async () => {
            fs.mkdirSync(path.dirname(databasePath), { recursive: true });

            dataSource = createDataSource(createFileDataSourceOptions({ synchronize: true }));
            setDataSource(dataSource);

            const result = await checkDatabase();

            expect(result).toEqual({
                exists: true,
                schema: false,
                migrationsPending: [],
            });
            expect(dataSource.isInitialized).toBe(false);
            expect(await readTableNames()).toEqual([]);
        });

        it('should use an initialized one as is', async () => {
            dataSource = createDataSource({
                ...createDataSourceOptions(),
                synchronize: true,
            });
            await dataSource.initialize();

            const counter = instrument(dataSource);

            setDataSource(dataSource);

            const result = await checkDatabase();

            // a copy would be a fresh in-memory database without tables
            expect(result.schema).toBe(true);
            expect(counter.createQueryRunner).toBeGreaterThanOrEqual(1);
            expect(dataSource.isInitialized).toBe(true);
        });
    });
});
