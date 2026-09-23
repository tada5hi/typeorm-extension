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
                { replication: { master: {}, slaves: [] } },
            ]) {
                expect(() => applyMysqlTimezone({
                    type: 'mysql', 
                    driver, 
                    ...settings, 
                } as any)).toThrow(OptionsError);
            }
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
