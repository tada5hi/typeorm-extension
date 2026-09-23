import { describe, expect, it } from 'vitest';
import { createMysqlUTCDriver } from '../../../../../src';

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
});
