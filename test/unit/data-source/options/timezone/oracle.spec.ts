import { describe, expect, it } from 'vitest';
import { OptionsError } from '../../../../../src';
import {
    applyOracleTimezone,
    createOracleUTCDriver,
    readLocalDateAsUTC,
    writeUTCAsLocalDate,
} from '../../../../../src/data-source/options/timezone/oracle';

class Marker {}

const TYPES = {
    DB_TYPE_DATE: 'date',
    DB_TYPE_TIMESTAMP: 'ts',
    DB_TYPE_TIMESTAMP_TZ: 'tstz',
    BIND_IN: 'in',
    BIND_OUT: 'out',
    BIND_INOUT: 'inout',
};

type Call = {
    sql: unknown, 
    binds: unknown, 
    options: any 
};

/**
 * A stand-in for node-oracledb covering the call shapes typeorm and direct
 * users make: promise and callback forms, pooled and standalone connections.
 * `outBinds` is what each execute answers with.
 */
function createFakeOracle(outBinds?: unknown) {
    const executed : Call[] = [];
    const many : Call[] = [];

    const connection = {
        execute(sql: unknown, binds: unknown, options: any, callback?: (err: unknown, result: unknown) => void) {
            executed.push({
                sql, 
                binds, 
                options, 
            });
            const result = { rows: [], outBinds };
            if (callback) {
                callback(null, result);
                return undefined;
            }

            return Promise.resolve(result);
        },
        executeMany(sql: unknown, binds: unknown, options: any) {
            many.push({
                sql, 
                binds, 
                options, 
            });
            return Promise.resolve({ outBinds });
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
        ...TYPES,
        Marker,
        createPool(_options: unknown, callback?: (err: unknown, pool: unknown) => void) {
            if (callback) {
                callback(null, pool);
                return undefined;
            }

            return Promise.resolve(pool);
        },
        getPool: () => pool,
        getConnection: () => Promise.resolve(connection),
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

describe('src/data-source/options/timezone/oracle', () => {
    describe('readLocalDateAsUTC / writeUTCAsLocalDate', () => {
        it('should take the local fields as UTC and back', () => {
            const local = new Date(2026, 8, 22, 11, 5, 49, 850);
            const utc = new Date('2026-09-22T11:05:49.850Z');

            expect(readLocalDateAsUTC(local)).toEqual(utc);
            expect(writeUTCAsLocalDate(utc)).toEqual(local);
        });

        it('should keep the years 0 to 99', () => {
            const local = new Date(2026, 0, 1);
            local.setFullYear(5);
            expect(readLocalDateAsUTC(local).getUTCFullYear()).toEqual(5);

            const utc = new Date('2026-01-01T00:00:00.000Z');
            utc.setUTCFullYear(5);
            expect(writeUTCAsLocalDate(utc).getFullYear()).toEqual(5);
        });
    });

    describe('createOracleUTCDriver', () => {
        it('should read a zone-less TIMESTAMP as UTC and nothing else', async () => {
            const { driver, executed } = createFakeOracle();
            const connection = await connect(createOracleUTCDriver(driver));

            await connection.execute('SELECT', [], { outFormat: 4002 });
            const { options } = executed[0];

            expect(options.outFormat).toEqual(4002);
            expect(options.fetchTypeHandler({ dbType: 'date' })).toBeUndefined();
            expect(options.fetchTypeHandler({ dbType: 'tstz' })).toBeUndefined();

            const { converter } = options.fetchTypeHandler({ dbType: 'ts' });
            expect(converter(new Date(2026, 8, 22, 11, 0))).toEqual(new Date('2026-09-22T11:00:00.000Z'));
            expect(converter(null)).toBeNull();
        });

        it('should let a caller or process-wide handler decide first', async () => {
            const { driver, executed } = createFakeOracle();
            const own = { type: 'string' };
            const connection = await connect(createOracleUTCDriver({ ...driver, fetchTypeHandler: () => own }));

            await connection.execute('SELECT', []);
            expect(executed[0].options.fetchTypeHandler({ dbType: 'ts' })).toBe(own);

            const call = { type: 'number' };
            await connection.execute('SELECT', [], { fetchTypeHandler: () => call });
            expect(executed[1].options.fetchTypeHandler({ dbType: 'ts' })).toBe(call);
        });

        it('should bind Date parameters as their UTC wall clock, keeping the plain type', async () => {
            const { driver, executed } = createFakeOracle();
            const connection = await connect(createOracleUTCDriver(driver));
            const date = new Date('2026-09-22T11:05:00.000Z');
            const wall = writeUTCAsLocalDate(date);

            await connection.execute('INSERT', [date, 1]);
            await connection.execute('INSERT', {
                at: date,
                typed: { val: date, type: 'ts' },
                day: { val: date, type: 'date' },
                zoned: { val: date, type: 'tstz' },
                many: { val: [date, 2] },
                out: { dir: 'out', type: 'ts' },
            });

            expect(executed[0].binds).toEqual([wall, 1]);
            expect(executed[1].binds).toEqual({
                at: wall,
                typed: { val: wall, type: 'ts' },
                day: { val: date, type: 'date' },
                zoned: { val: date, type: 'tstz' },
                many: { val: [wall, 2] },
                out: { dir: 'out', type: 'ts' },
            });
        });

        it('should read TIMESTAMP out-binds as UTC, by name and by position', async () => {
            const local = new Date(2026, 8, 22, 11, 0);
            const utc = new Date('2026-09-22T11:00:00.000Z');

            const named = createFakeOracle({
                at: [local], 
                id: [1], 
                stamp: [local], 
            });
            let connection = await connect(createOracleUTCDriver(named.driver));
            const result = await connection.execute('INSERT', {
                at: { dir: 'out', type: 'ts' },
                id: { dir: 'out', type: 'number' },
                stamp: { dir: 'out', type: 'tstz' },
            });

            expect(result.outBinds).toEqual({
                at: [utc], 
                id: [1], 
                stamp: [local], 
            });

            const positional = createFakeOracle([local, 1]);
            connection = await connect(createOracleUTCDriver(positional.driver));
            const second = await connection.execute('INSERT', [1, { dir: 'out', type: 'ts' }, {
                dir: 'inout', 
                type: 'number', 
                val: 1, 
            }]);

            expect(second.outBinds).toEqual([utc, 1]);
        });

        it('should convert out-binds in the callback form too', async () => {
            const local = new Date(2026, 8, 22, 11, 0);
            const { driver } = createFakeOracle({ at: local });
            const connection = await connect(createOracleUTCDriver(driver));

            const result = await new Promise<any>((resolve) => {
                connection.execute('INSERT', { at: { dir: 'out', type: 'ts' } }, {}, (_err: unknown, value: unknown) => resolve(value));
            });

            expect(result.outBinds.at).toEqual(new Date('2026-09-22T11:00:00.000Z'));
        });

        it('should bind executeMany rows as plain values and read its out-binds', async () => {
            const local = new Date(2026, 8, 22, 11, 0);
            const { driver, many } = createFakeOracle([{ at: local }]);
            const connection = await connect(createOracleUTCDriver(driver));
            const date = new Date('2026-09-22T11:05:00.000Z');

            const result = await connection.executeMany('INSERT', [[date, 1], { at: date }], { bindDefs: { at: { dir: 'out', type: 'ts' } } });

            expect(many[0].binds).toEqual([[writeUTCAsLocalDate(date), 1], { at: writeUTCAsLocalDate(date) }]);
            expect(result.outBinds).toEqual([{ at: new Date('2026-09-22T11:00:00.000Z') }]);
        });

        it('should support the callback and the promise forms', async () => {
            const { driver, executed } = createFakeOracle();
            const wrapped : any = createOracleUTCDriver(driver);

            const pool = await wrapped.createPool({});
            const connection = await pool.getConnection();

            await new Promise((resolve) => {
                connection.execute('SELECT', resolve);
            });
            await new Promise((resolve) => {
                connection.execute('SELECT', [], resolve);
            });

            expect(executed.map((entry) => typeof entry.options.fetchTypeHandler)).toEqual(['function', 'function']);
            expect(connection.close()).toEqual('closed');
        });

        it('should wrap standalone connections and named pools', async () => {
            const { driver, executed } = createFakeOracle();
            const wrapped : any = createOracleUTCDriver(driver);

            const standalone = await wrapped.getConnection();
            await standalone.execute('SELECT', []);

            const pooled = await wrapped.getPool().getConnection();
            await pooled.execute('SELECT', []);

            expect(executed.map((entry) => entry.sql)).toEqual(['ALTER SESSION SET TIME_ZONE = \'+00:00\'', 'SELECT', 'SELECT']);
            expect(executed.slice(1).map((entry) => typeof entry.options.fetchTypeHandler)).toEqual(['function', 'function']);
        });

        it('should pin a standalone connection in the callback form, and close one it could not pin', async () => {
            const { driver, executed } = createFakeOracle();
            const connection = await new Promise<any>((resolve) => {
                const getConnection = (callback: any) => driver.getConnection().then((value) => callback(null, value));
                const wrapped : any = createOracleUTCDriver({ ...driver, getConnection });
                wrapped.getConnection((_err: unknown, value: unknown) => resolve(value));
            });
            expect(executed[0].sql).toEqual('ALTER SESSION SET TIME_ZONE = \'+00:00\'');
            await connection.execute('SELECT', []);
            expect(typeof executed[1].options.fetchTypeHandler).toEqual('function');

            let closed = false;
            const failing = {
                execute: () => Promise.reject(new Error('denied')),
                close: () => { closed = true; },
            };
            const wrapped : any = createOracleUTCDriver({ ...driver, getConnection: () => Promise.resolve(failing) });
            await expect(wrapped.getConnection()).rejects.toThrow('denied');
            expect(closed).toBe(true);
        });

        it('should honour the bindDefs types of executeMany', async () => {
            const { driver, many } = createFakeOracle();
            const connection = await connect(createOracleUTCDriver(driver));
            const date = new Date('2026-09-22T11:05:00.000Z');
            const wall = writeUTCAsLocalDate(date);

            await connection.executeMany('INSERT', [[date, date, date, date]], {
                bindDefs: [
                    { type: 'ts' },
                    { type: 'date' },
                    { type: 'tstz' },
                    {},
                ],
            });
            await connection.executeMany('INSERT', [{ a: date, b: date }], { bindDefs: { a: { type: 'date' }, b: { type: 'ts' } } });

            expect(many[0].binds).toEqual([[wall, date, date, wall]]);
            expect(many[1].binds).toEqual([{ a: date, b: wall }]);
        });

        it('should read an untyped INOUT Date bind back as UTC', async () => {
            const local = new Date(2026, 8, 22, 11, 0);
            const { driver } = createFakeOracle({ at: local, n: 1 });
            const connection = await connect(createOracleUTCDriver(driver));
            const date = new Date('2026-09-22T11:05:00.000Z');

            const result = await connection.execute('BEGIN', {
                at: { dir: 'inout', val: date },
                n: { dir: 'inout', val: 1 },
            });

            expect(result.outBinds).toEqual({ at: new Date('2026-09-22T11:00:00.000Z'), n: 1 });
        });

        it('should pass classes through untouched and keep method identity', async () => {
            const { driver } = createFakeOracle();
            const wrapped : any = createOracleUTCDriver(driver);

            expect(wrapped.Marker).toBe(Marker);
            expect(new Marker()).toBeInstanceOf(wrapped.Marker);
            expect(wrapped.DB_TYPE_TIMESTAMP).toEqual('ts');
            expect(wrapped.createPool).toBe(wrapped.createPool);

            const connection = await connect(wrapped);
            expect(connection.execute).toBe(connection.execute);
        });
    });

    describe('applyOracleTimezone', () => {
        function runSessionCallback(callback: any) {
            const executed : string[] = [];
            let result : unknown = 'pending';

            callback({
                execute: (sql: string, done: (err: unknown) => void) => {
                    executed.push(sql);
                    done(null);
                },
            }, 'tag', (err?: unknown) => { result = err; });

            return { executed, result };
        }

        it('should pin the session and wrap the driver', () => {
            const { driver } = createFakeOracle();
            const options = applyOracleTimezone({
                type: 'oracle', 
                driver, 
                extra: { poolMax: 2 }, 
            }) as any;

            expect(options.extra.poolMax).toEqual(2);
            expect(options.driver).not.toBe(driver);

            const { executed, result } = runSessionCallback(options.extra.sessionCallback);
            expect(executed).toEqual(['ALTER SESSION SET TIME_ZONE = \'+00:00\'']);
            expect(result).toBeUndefined();
        });

        it('should run a caller sessionCallback after the pin', () => {
            const { driver } = createFakeOracle();
            const seen : string[] = [];
            const options = applyOracleTimezone({
                type: 'oracle',
                driver,
                extra: {
                    sessionCallback: (_connection: unknown, tag: string, done: () => void) => {
                        seen.push(tag);
                        done();
                    },
                },
            }) as any;

            const { executed } = runSessionCallback(options.extra.sessionCallback);
            expect(executed).toEqual(['ALTER SESSION SET TIME_ZONE = \'+00:00\'']);
            expect(seen).toEqual(['tag']);
        });

        it('should refuse a sessionCallback naming a PL/SQL procedure', () => {
            const { driver } = createFakeOracle();

            expect(() => applyOracleTimezone({
                type: 'oracle', 
                driver, 
                extra: { sessionCallback: 'pkg.init' }, 
            }))
                .toThrow(OptionsError);
        });

        it('should be idempotent, and refuse a pin altered after it was applied', () => {
            const { driver } = createFakeOracle();
            const once = applyOracleTimezone({ type: 'oracle', driver }) as any;

            expect(applyOracleTimezone(once)).toBe(once);
            expect(() => applyOracleTimezone({ ...once, extra: { sessionCallback: () => undefined } }))
                .toThrow(OptionsError);
        });
    });
});
