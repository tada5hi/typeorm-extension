import { describe, expect, it } from 'vitest';
import { DatabaseLockError, DriverError, withDatabaseLock } from '../../../../src';
import { isDatabaseLockAcquired } from '../../../../src/database/lock/module';
import { createFakeQueryRunner } from '../../../data/typeorm/FakeQueryRunner';

describe('src/database/lock', () => {
    it('should read the acquired flag of every driver', () => {
        expect(isDatabaseLockAcquired([{ acquired: true }])).toBeTruthy();
        expect(isDatabaseLockAcquired([{ acquired: 1 }])).toBeTruthy();
        expect(isDatabaseLockAcquired([{ acquired: '1' }])).toBeTruthy();

        expect(isDatabaseLockAcquired([{ acquired: false }])).toBeFalsy();
        expect(isDatabaseLockAcquired([{ acquired: '0' }])).toBeFalsy();
        expect(isDatabaseLockAcquired([{ acquired: 0 }])).toBeFalsy();
        expect(isDatabaseLockAcquired([{ acquired: null }])).toBeFalsy();
        expect(isDatabaseLockAcquired([])).toBeFalsy();
        expect(isDatabaseLockAcquired(undefined)).toBeFalsy();
    });

    it('should rely only on driver internals which exist', async () => {
        // The session discard reaches into typeorm and mysql2: an upgrade
        // removing either would silently pool a session holding the lock.
        const { PostgresQueryRunner } = await import('typeorm/driver/postgres/PostgresQueryRunner');
        const { PoolConnection } = await import('mysql2');

        expect(typeof PostgresQueryRunner.prototype['releasePostgresConnection' as keyof typeof PostgresQueryRunner.prototype]).toEqual('function');
        expect(typeof PoolConnection.prototype.destroy).toEqual('function');
    });

    it('should acquire and release the lock around the callback', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            respond: () => [{ acquired: true }],
        });

        const output = await withDatabaseLock(queryRunner, 'migrations', async () => {
            expect(queryRunner.queries).toHaveLength(1);

            return 'done';
        });

        expect(output).toEqual('done');
        expect(queryRunner.queries).toEqual([
            'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS "acquired"',
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS "released"',
        ]);
        expect(queryRunner.parameters).toEqual([['migrations'], ['migrations']]);
    });

    it('should namespace the mysql lock with the database', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mariadb',
            respond: () => [{ acquired: '1' }],
        });

        await withDatabaseLock(queryRunner, 'migrations', async () => 'done');

        expect(queryRunner.queries).toEqual([
            'SELECT GET_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256), 0) AS `acquired`',
            'SELECT RELEASE_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256)) AS `released`',
        ]);
    });

    it('should release the lock if the callback throws', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            respond: () => [{ acquired: '1' }],
        });

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(queryRunner.queries).toHaveLength(2);
    });

    it('should keep the callback error if the release fails', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            respond: (query) => {
                if (query.includes('unlock')) {
                    throw new Error('current transaction is aborted');
                }

                return [{ acquired: true }];
            },
        });

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');
    });

    function failRelease(type: 'postgres' | 'mysql') {
        return createFakeQueryRunner({
            type,
            respond: (query) => {
                if (query.includes('unlock') || query.includes('RELEASE_LOCK')) {
                    throw new Error('current transaction is aborted');
                }

                return [{ acquired: true }];
            },
        });
    }

    it('should end the postgres session if the release fails', async () => {
        for (const outcome of ['throws', 'returns'] as const) {
            const queryRunner = failRelease('postgres');
            const discarded : unknown[] = [];

            Object.assign(queryRunner, {
                isReleased: false,
                async releasePostgresConnection(error: unknown) {
                    discarded.push(error);
                    Object.assign(queryRunner, { isReleased: true });
                },
            });

            const promise = withDatabaseLock(queryRunner, 'migrations', async () => {
                if (outcome === 'throws') {
                    throw new Error('boom');
                }

                return 'done';
            });

            if (outcome === 'throws') {
                await expect(promise).rejects.toThrow('boom');
            } else {
                const error = await promise.catch((e) => e);

                expect(error).toBeInstanceOf(DatabaseLockError);
                expect(error.cause).toBeInstanceOf(Error);
                expect(error.cause.message).toEqual('current transaction is aborted');
            }

            expect(discarded).toHaveLength(1);
            expect((discarded[0] as Error).message).toEqual('current transaction is aborted');
            expect(queryRunner.isReleased).toBe(true);
        }
    });

    it('should destroy the mysql connection if the release fails', async () => {
        for (const outcome of ['throws', 'returns'] as const) {
            const queryRunner = failRelease('mysql');
            let destroyed = 0;

            Object.assign(queryRunner, {
                isReleased: false,
                databaseConnection: {
                    destroy: () => {
                        destroyed++;
                    },
                },
            });

            const promise = withDatabaseLock(queryRunner, 'migrations', async () => {
                if (outcome === 'throws') {
                    throw new Error('boom');
                }

                return 'done';
            });

            if (outcome === 'throws') {
                await expect(promise).rejects.toThrow('boom');
            } else {
                await expect(promise).rejects.toBeInstanceOf(DatabaseLockError);
            }

            expect(destroyed).toEqual(1);
            expect(queryRunner.isReleased).toBe(true);
        }
    });

    it('should prefer the failed release over a transaction left open', async () => {
        const queryRunner = failRelease('mysql');

        // no connection object: the discard must not throw
        Object.assign(queryRunner, { isReleased: false });

        const error = await withDatabaseLock(queryRunner, 'migrations', async () => {
            queryRunner.isTransactionActive = true;

            return 'done';
        }).catch((e) => e);

        expect(error).toBeInstanceOf(DatabaseLockError);
        expect(error.message).toContain('could not be released');
        expect(queryRunner.isReleased).toBe(true);
    });

    it('should refuse a query runner in a transaction', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'postgres' });

        queryRunner.isTransactionActive = true;

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => 'done'))
            .rejects.toThrow(DatabaseLockError);
        expect(queryRunner.queries).toHaveLength(0);
    });

    it('should roll back a transaction the callback leaves behind before the release', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            respond: () => [{ acquired: true }],
        });

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            queryRunner.isTransactionActive = true;

            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(queryRunner.queries.slice(1)).toEqual([
            'ROLLBACK',
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS "released"',
        ]);

        queryRunner.queries = [];
        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            queryRunner.isTransactionActive = true;

            return 'done';
        })).rejects.toThrow(DatabaseLockError);

        expect(queryRunner.queries.slice(1)).toEqual([
            'ROLLBACK',
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS "released"',
        ]);
    });

    it('should roll back nested transactions the callback leaves behind', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'postgres',
            respond: () => [{ acquired: true }],
        });

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            queryRunner.isTransactionActive = true;
            queryRunner.transactionDepth = 2;

            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(queryRunner.isTransactionActive).toBe(false);
        expect(queryRunner.queries.slice(1)).toEqual([
            'ROLLBACK TO SAVEPOINT',
            'ROLLBACK',
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS "released"',
        ]);
    });

    it('should give up on a NaN timeout instead of polling forever', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            respond: () => [{ acquired: '0' }],
        });

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => 'done', { timeout: NaN }))
            .rejects.toThrow(DatabaseLockError);
        expect(queryRunner.queries).toHaveLength(1);
    });

    it('should wait until the lock is free', async () => {
        let attempts = 0;
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            respond: (query) => {
                if (query.includes('GET_LOCK')) {
                    attempts++;

                    return [{ acquired: attempts < 3 ? '0' : '1' }];
                }

                return [{ released: '1' }];
            },
        });

        await withDatabaseLock(queryRunner, 'migrations', async () => 'done');

        expect(attempts).toEqual(3);
    });

    it('should not run the callback if the lock is not acquired in time', async () => {
        const queryRunner = createFakeQueryRunner({
            type: 'mysql',
            respond: () => [{ acquired: '0' }],
        });

        let called = false;

        await expect(withDatabaseLock(queryRunner, 'migrations', async () => {
            called = true;
        }, { timeout: 0 })).rejects.toThrow(DatabaseLockError);

        expect(called).toBeFalsy();
        expect(queryRunner.queries).toHaveLength(1);
    });

    it('should refuse a driver without an advisory lock', async () => {
        for (const type of ['better-sqlite3', 'cockroachdb', 'mssql'] as const) {
            const queryRunner = createFakeQueryRunner({ type });

            await expect(withDatabaseLock(queryRunner, 'migrations', async () => 'done'))
                .rejects.toThrow(DriverError);
            expect(queryRunner.queries).toHaveLength(0);
        }
    });

    it('should run the callback without a lock on an unsupported driver if not strict', async () => {
        const queryRunner = createFakeQueryRunner({ type: 'better-sqlite3' });

        const output = await withDatabaseLock(queryRunner, 'migrations', async () => 'done', { strict: false });

        expect(output).toEqual('done');
        expect(queryRunner.queries).toHaveLength(0);
    });
});
