import type { DataSource, QueryRunner } from 'typeorm';
import { DataSource as TypeORMDataSource } from 'typeorm';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    DatabaseLockError,
    DriverError,
    withDatabaseLock,
} from '../../../src';
import {
    createIntegrationDataSourceOptions,
    supportsDatabaseLock,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

const SECOND_DATABASE = 'typeorm_extension_lock';

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe.runIf(supportsDatabaseLock(driver))(`src/database/lock (${driver})`, () => {
    let dataSource : DataSource;
    let runners : QueryRunner[];

    // Every query runner holds its own connection, which is what makes the
    // two sessions of a test actually compete for the lock.
    async function connect(source: DataSource = dataSource) : Promise<QueryRunner> {
        const queryRunner = source.createQueryRunner();
        await queryRunner.connect();
        runners.push(queryRunner);

        return queryRunner;
    }

    async function isFree(name: string, source?: DataSource) : Promise<boolean> {
        const queryRunner = await connect(source);

        try {
            return await withDatabaseLock(queryRunner, name, async () => true, { timeout: 0 });
        } catch (e) {
            if (e instanceof DatabaseLockError) {
                return false;
            }

            throw e;
        }
    }

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions());
        await dataSource.initialize();
    });

    beforeEach(() => {
        runners = [];
    });

    afterEach(async () => {
        await Promise.all(runners.map((runner) => runner.release()));
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should keep a second session out while the lock is held', async () => {
        const a = await connect();
        const b = await connect();

        await withDatabaseLock(a, 'held', async () => {
            await expect(withDatabaseLock(b, 'held', async () => 'b', { timeout: 0 }))
                .rejects.toBeInstanceOf(DatabaseLockError);

            // another name is not affected
            await expect(withDatabaseLock(b, 'other', async () => 'b', { timeout: 0 }))
                .resolves.toEqual('b');
        });

        await expect(withDatabaseLock(b, 'held', async () => 'b', { timeout: 0 }))
            .resolves.toEqual('b');
    });

    it('should release the lock when the callback throws', async () => {
        const a = await connect();

        await expect(withDatabaseLock(a, 'throws', async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(await isFree('throws')).toBe(true);
    });

    it('should release the lock after a failed transaction in the callback', async () => {
        const a = await connect();

        // postgres aborts the transaction, and would refuse the unlock inside it.
        await expect(withDatabaseLock(a, 'transaction', async () => {
            await a.startTransaction();
            await a.query('SELECT * FROM typeorm_extension_missing_table');
        })).rejects.toThrow();

        expect(a.isTransactionActive).toBe(false);
        expect(await isFree('transaction')).toBe(true);

        // a nested transaction is a savepoint: the outer one has to go as well.
        await expect(withDatabaseLock(a, 'transaction', async () => {
            await a.startTransaction();
            await a.startTransaction();
            await a.query('SELECT * FROM typeorm_extension_missing_table');
        })).rejects.toThrow();

        expect(a.isTransactionActive).toBe(false);
        expect(await isFree('transaction')).toBe(true);

        await expect(withDatabaseLock(a, 'transaction', async () => {
            await a.startTransaction();
        })).rejects.toBeInstanceOf(DatabaseLockError);

        expect(await isFree('transaction')).toBe(true);
    });

    it('should not deadlock on nested calls with the same name', async () => {
        const a = await connect();

        const result = await withDatabaseLock(a, 'nested', async () => withDatabaseLock(
            a,
            'nested',
            async () => {
                expect(await isFree('nested')).toBe(false);

                return 'inner';
            },
            { timeout: 0 },
        ), { timeout: 0 });

        expect(result).toEqual('inner');

        // both acquisitions are released, not just the inner one
        expect(await isFree('nested')).toBe(true);
    });

    it('should wait for the lock until it is released', async () => {
        const a = await connect();
        const b = await connect();

        const events : string[] = [];
        let waiting! : Promise<void>;

        await withDatabaseLock(a, 'wait', async () => {
            waiting = withDatabaseLock(b, 'wait', async () => {
                events.push('b');
            }, { timeout: 10_000 });

            await delay(500);
            events.push('a');
        });

        await waiting;

        expect(events).toEqual(['a', 'b']);
    });

    it('should give up waiting after the timeout', async () => {
        const a = await connect();
        const b = await connect();

        await withDatabaseLock(a, 'timeout', async () => {
            const start = Date.now();

            await expect(withDatabaseLock(b, 'timeout', async () => 'b', { timeout: 300 }))
                .rejects.toBeInstanceOf(DatabaseLockError);

            expect(Date.now() - start).toBeGreaterThanOrEqual(300);
        });
    });

    it.runIf(driver === 'mysql' || driver === 'mariadb')('should scope the lock to the database', async () => {
        await dataSource.query(`CREATE DATABASE IF NOT EXISTS \`${SECOND_DATABASE}\``);

        const second = new TypeORMDataSource(createIntegrationDataSourceOptions([], { database: SECOND_DATABASE }));
        await second.initialize();

        try {
            const a = await connect();

            await withDatabaseLock(a, 'scoped', async () => {
                expect(await isFree('scoped')).toBe(false);
                expect(await isFree('scoped', second)).toBe(true);
            });
        } finally {
            await Promise.all(runners.splice(0).map((runner) => runner.release()));
            await second.destroy();
            await dataSource.query(`DROP DATABASE IF EXISTS \`${SECOND_DATABASE}\``);
        }
    });
});

describe.runIf(driver && !supportsDatabaseLock(driver))(`src/database/lock (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(createIntegrationDataSourceOptions());
        await dataSource.initialize();
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should refuse to take a lock', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            await expect(withDatabaseLock(queryRunner, 'unsupported', async () => 'x'))
                .rejects.toBeInstanceOf(DriverError);
        } finally {
            await queryRunner.release();
        }
    });
});
