import mysql2 from 'mysql2';
import { describe, expect, it } from 'vitest';
import { OptionsError } from '../../../../../src';
import { applyMysqlTimezone, createMysqlUTCDriver } from '../../../../../src/data-source/options/timezone/mysql';

describe('src/data-source/options/timezone/mysql', () => {
    describe('createMysqlUTCDriver', () => {
        function createPool() {
            const listeners : ((connection: any) => void)[] = [];
            const pool = {
                on: (event: string, listener: (connection: any) => void) => {
                    if (event === 'connection') {
                        listeners.push(listener);
                    }
                },
            };

            return { pool, listeners };
        }

        it('should run the session SET first on every new connection', () => {
            const { pool, listeners } = createPool();
            const driver = createMysqlUTCDriver({ createPool: (..._args: any[]) => pool, format: () => '' });

            expect(driver.createPool({})).toBe(pool);
            expect(typeof driver.format).toEqual('function');
            expect(listeners).toHaveLength(1);

            const queries : string[] = [];
            listeners[0]({
                query: (sql: string, callback: (err: unknown) => void) => {
                    queries.push(sql);
                    callback(null);
                },
                destroy: () => { throw new Error('must not destroy'); },
            });

            expect(queries).toEqual(['SET time_zone = \'+00:00\'']);
        });

        it('should destroy a connection whose SET fails', () => {
            const { pool, listeners } = createPool();
            createMysqlUTCDriver({ createPool: (..._args: any[]) => pool }).createPool({});

            let destroyed = false;
            listeners[0]({
                query: (_sql: string, callback: (err: unknown) => void) => callback(new Error('denied')),
                destroy: () => { destroyed = true; },
            });

            expect(destroyed).toBe(true);
        });
    });

    describe('createMysqlUTCDriver (pool cluster)', () => {
        type Callback = (err: unknown, connection?: any) => void;

        function createConnection(fail = false) {
            const connection = {
                queries: [] as string[],
                destroyed: false,
                query: (sql: string, callback: (err: unknown) => void) => {
                    connection.queries.push(sql);
                    callback(fail ? new Error('denied') : null);
                },
                destroy: () => { connection.destroyed = true; },
            };

            return connection;
        }

        /**
         * A real mysql2 cluster, so the routing of getConnection / of()
         * is mysql2's own; only the node pools are replaced, since they
         * would connect to a server.
         */
        function createCluster(next: () => { err?: unknown, connection?: any }) {
            const cluster = createMysqlUTCDriver(mysql2 as any).createPoolCluster!() as any;
            for (const id of ['MASTER', 'SLAVE0']) {
                cluster.add(id, {});
                cluster._nodes[id].pool.getConnection = (cb: Callback) => {
                    const { err, connection } = next();
                    cb(err ?? null, connection);
                };
            }

            return cluster;
        }

        function getConnection(target: { getConnection: (...args: any[]) => unknown }, ...args: any[]) {
            return new Promise<{ err: unknown, connection: any }>((resolve) => {
                target.getConnection(...args, (err: unknown, connection: any) => resolve({ err, connection }));
            });
        }

        it('should pin a session once, before handing it out', async () => {
            const first = createConnection();
            const second = createConnection();
            const queue = [first, first, second];
            const cluster = createCluster(() => ({ connection: queue.shift() }));

            expect((await getConnection(cluster, 'MASTER')).connection).toBe(first);
            expect((await getConnection(cluster, 'SLAVE*')).connection).toBe(first);
            expect((await getConnection(cluster.of('SLAVE*'))).connection).toBe(second);

            expect(first.queries).toEqual(['SET time_zone = \'+00:00\'']);
            expect(second.queries).toEqual(['SET time_zone = \'+00:00\'']);
        });

        it('should destroy a session whose SET fails and hand out the error', async () => {
            const connection = createConnection(true);
            const cluster = createCluster(() => ({ connection }));

            const result = await getConnection(cluster, 'MASTER');

            expect(result.err).toBeInstanceOf(Error);
            expect(result.connection).toBeUndefined();
            expect(connection.destroyed).toBe(true);
        });

        it('should pass a pool error through untouched', async () => {
            const error = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
            const cluster = createCluster(() => ({ err: error }));
            cluster._canRetry = false;

            expect((await getConnection(cluster, 'MASTER')).err).toBe(error);
        });

        it('should leave a driver without pool clusters without one', () => {
            const driver : Record<string, unknown> = createMysqlUTCDriver({ createPool: () => ({ on: () => undefined }) });

            expect(driver.createPoolCluster).toBeUndefined();
        });
    });

    describe('applyMysqlTimezone', () => {
        const driver = { createPool: () => ({ on: () => undefined }) };

        it.each(['mysql', 'mariadb'] as const)('should pin %s and keep DATE values as strings', (type) => {
            const options = applyMysqlTimezone({
                type, 
                driver, 
                extra: { connectionLimit: 3 }, 
            }) as any;

            expect(options).toMatchObject({
                timezone: 'Z', 
                dateStrings: ['DATE'], 
                extra: { connectionLimit: 3 }, 
            });
            expect(options.driver).not.toBe(driver);
        });

        it('should accept settings which already agree', () => {
            for (const settings of [
                { timezone: 'Z' },
                { timezone: '+00:00' },
                { extra: { timezone: '-00:00' } },
                { dateStrings: ['DATE'] },
                { dateStrings: false },
            ]) {
                const options = applyMysqlTimezone({
                    type: 'mysql', 
                    driver, 
                    ...settings, 
                }) as any;
                expect(options).toMatchObject({ timezone: 'Z', dateStrings: ['DATE'] });
                expect(options.extra.timezone).toBeUndefined();
            }
        });

        it('should refuse settings which contradict the pin', () => {
            for (const settings of [
                { timezone: '+02:00' },
                { timezone: 'local' },
                { extra: { timezone: 'local' } },
                { dateStrings: true },
                { dateStrings: ['DATETIME'] },
                { extra: { typeCast: () => undefined } },
                { replication: { master: {}, slaves: [] }, timezone: 'local' },
            ]) {
                expect(() => applyMysqlTimezone({
                    type: 'mysql', 
                    driver, 
                    ...settings, 
                } as any)).toThrow(OptionsError);
            }
        });

        it('should pin a replication setup', () => {
            const options = applyMysqlTimezone({
                type: 'mysql',
                driver: mysql2,
                replication: { master: {}, slaves: [{}] },
            }) as any;

            expect(options).toMatchObject({ timezone: 'Z', dateStrings: ['DATE'] });
            expect(options.driver.createPoolCluster).not.toBe(mysql2.createPoolCluster);
            expect(applyMysqlTimezone(options)).toBe(options);
        });

        it('should be idempotent, and refuse a pin altered after it was applied', () => {
            const once = applyMysqlTimezone({ type: 'mysql', driver });
            expect(applyMysqlTimezone(once)).toBe(once);

            expect(() => applyMysqlTimezone({ ...once, timezone: 'local' })).toThrow(OptionsError);
            expect(() => applyMysqlTimezone({ ...once, extra: { dateStrings: true } })).toThrow(OptionsError);
            expect(() => applyMysqlTimezone({ ...once, extra: { typeCast: () => undefined } })).toThrow(OptionsError);
        });
    });
});
