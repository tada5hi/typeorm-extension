 
import { describe, expect, it } from 'vitest';
import { createOracleUTCDriver, readLocalDateAsUTC } from '../../../../../src';

describe('src/data-source/options/timezone/oracle', () => {
    describe('readLocalDateAsUTC', () => {
        it('should take the local fields as UTC', () => {
            expect(readLocalDateAsUTC(new Date(2026, 8, 22, 11, 5, 49, 850))).toEqual(new Date('2026-09-22T11:05:49.850Z'));
        });

        it('should keep the years 0 to 99', () => {
            const local = new Date(2026, 0, 1);
            local.setFullYear(5);

            expect(readLocalDateAsUTC(local).getUTCFullYear()).toEqual(5);
        });
    });

    describe('createOracleUTCDriver', () => {
        class Marker {}

        function createFakeOracle() {
            const executed : {
                sql: unknown, 
                binds: unknown, 
                options: any 
            }[] = [];
            const many : unknown[] = [];

            const connection = {
                execute(sql: unknown, binds: unknown, options: any, callback?: unknown) {
                    executed.push({
                        sql, 
                        binds, 
                        options, 
                    });
                    return callback ?? 'executed';
                },
                executeMany(_sql: unknown, binds: unknown) {
                    many.push(binds);
                    return 'many';
                },
                close: () => 'closed',
            };

            const pool = {
                getConnection(callback?: (err: unknown, connection: unknown) => void) {
                    if (callback) {
                        callback(null, connection);
                        return undefined;
                    }

                    return Promise.resolve(connection);
                },
            };

            const driver = {
                DB_TYPE_TIMESTAMP: 'ts',
                DB_TYPE_TIMESTAMP_TZ: 'tstz',
                Marker,
                createPool(_options: unknown, callback?: (err: unknown, pool: unknown) => void) {
                    if (callback) {
                        callback(null, pool);
                        return undefined;
                    }

                    return Promise.resolve(pool);
                },
            };

            return {
                driver, 
                executed, 
                many, 
            };
        }

        async function connect(driver: any) {
            const pool = await new Promise<any>((resolve) => {
                driver.createPool({}, (_err: unknown, value: unknown) => resolve(value));
            });

            return new Promise<any>((resolve) => {
                pool.getConnection((_err: unknown, value: unknown) => resolve(value));
            });
        }

        it('should read a zone-less TIMESTAMP as UTC and nothing else', async () => {
            const { driver, executed } = createFakeOracle();
            const connection = await connect(createOracleUTCDriver(driver));

            connection.execute('SELECT', [], { outFormat: 4002 });
            const { options } = executed[0];

            expect(options.outFormat).toEqual(4002);
            expect(options.fetchTypeHandler({ dbType: 'other' })).toBeUndefined();

            const { converter } = options.fetchTypeHandler({ dbType: 'ts' });
            expect(converter(new Date(2026, 8, 22, 11, 0))).toEqual(new Date('2026-09-22T11:00:00.000Z'));
            expect(converter(null)).toBeNull();
        });

        it('should let a caller or process-wide handler decide first', async () => {
            const { driver, executed } = createFakeOracle();
            const own = { type: 'string' };
            const connection = await connect(createOracleUTCDriver({ ...driver, fetchTypeHandler: () => own }));

            connection.execute('SELECT', []);
            expect(executed[0].options.fetchTypeHandler({ dbType: 'ts' })).toBe(own);

            const call = { type: 'number' };
            connection.execute('SELECT', [], { fetchTypeHandler: () => call });
            expect(executed[1].options.fetchTypeHandler({ dbType: 'ts' })).toBe(call);
        });

        it('should bind Date parameters as instants', async () => {
            const {
                driver, 
                executed, 
                many, 
            } = createFakeOracle();
            const connection = await connect(createOracleUTCDriver(driver));
            const date = new Date();

            connection.execute('INSERT', [date, 1]);
            connection.execute('INSERT', {
                at: date, 
                typed: { val: date, type: 'date' }, 
                bare: { val: date }, 
            });
            connection.executeMany('INSERT', [[date], { at: date }]);

            expect(executed[0].binds).toEqual([{ val: date, type: 'tstz' }, 1]);
            expect(executed[1].binds).toEqual({
                at: { val: date, type: 'tstz' },
                typed: { val: date, type: 'date' },
                bare: { val: date, type: 'tstz' },
            });
            expect(many[0]).toEqual([[{ val: date, type: 'tstz' }], { at: { val: date, type: 'tstz' } }]);
        });

        it('should support the callback and the promise forms', async () => {
            const { driver, executed } = createFakeOracle();
            const wrapped : any = createOracleUTCDriver(driver);

            const pool = await wrapped.createPool({});
            const connection = await pool.getConnection();
            const callback = () => undefined;

            expect(connection.execute('SELECT', callback)).toBe(callback);
            expect(connection.execute('SELECT', [], callback)).toBe(callback);
            expect(executed.map((entry) => typeof entry.options.fetchTypeHandler)).toEqual(['function', 'function']);
            expect(connection.close()).toEqual('closed');
        });

        it('should pass classes through untouched', () => {
            const { driver } = createFakeOracle();
            const wrapped : any = createOracleUTCDriver(driver);

            expect(wrapped.Marker).toBe(Marker);
            expect(new Marker()).toBeInstanceOf(wrapped.Marker);
        });
    });
});
