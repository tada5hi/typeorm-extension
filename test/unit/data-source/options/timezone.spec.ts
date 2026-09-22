/* eslint-disable max-classes-per-file */
import type { DataSourceOptions } from 'typeorm';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    EnvironmentVariableName,
    OptionsError,
    createMysqlUTCDriver,
    createOracleUTCDriver,
    createPostgresUTCClient,
    createPostgresUTCTypes,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
    readLocalDateAsUTC,
    resetEnv,
    serializePostgresDateAsUTC,
    withDataSourceTimezone,
} from '../../../../src';

type Extra = { extra: Record<string, any> };

const pg = PlatformTools.load('pg');

/**
 * Every variable this suite reads, in both spellings: a leftover alias in the
 * shell running the tests would otherwise answer for the one a test cleared.
 */
const ENV_KEYS = [
    EnvironmentVariableName.TIMEZONE,
    EnvironmentVariableName.TIMEZONE_ALT,
    EnvironmentVariableName.URL,
    EnvironmentVariableName.URL_ALT,
    EnvironmentVariableName.TYPE,
    EnvironmentVariableName.TYPE_ALT,
];

describe('src/data-source/options/timezone', () => {
    const saved : Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
        resetEnv();
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (typeof saved[key] === 'undefined') {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
        resetEnv();
    });

    describe('createPostgresUTCTypes', () => {
        const types = createPostgresUTCTypes(pg.types);
        const parse = types.getTypeParser(1114, 'text');

        it('should read a zone-less timestamp as UTC', () => {
            expect(parse('2026-09-22 19:05:49.850123')).toEqual(new Date('2026-09-22T19:05:49.850Z'));
            expect(parse('2026-09-22 19:05:49')).toEqual(new Date('2026-09-22T19:05:49.000Z'));
        });

        it('should keep infinity and BC dates working', () => {
            expect(parse('infinity')).toEqual(Infinity);
            expect(parse('-infinity')).toEqual(-Infinity);

            const bc = parse('0005-01-01 00:00:00 BC') as Date;
            expect(bc.getUTCFullYear()).toEqual(-4);
            expect(bc.getUTCHours()).toEqual(0);
        });

        it('should delegate every other type and the binary format', () => {
            expect(types.getTypeParser(1184, 'text')).toBe(pg.types.getTypeParser(1184, 'text'));
            expect(types.getTypeParser(23, 'text')).toBe(pg.types.getTypeParser(23, 'text'));
            expect(types.getTypeParser(1114, 'binary')).toBe(pg.types.getTypeParser(1114, 'binary'));
        });
    });

    describe('serializePostgresDateAsUTC', () => {
        it('should serialize the UTC fields with an explicit offset', () => {
            expect(serializePostgresDateAsUTC(new Date('2026-09-22T21:05:49.850Z'))).toEqual('2026-09-22T21:05:49.850+00:00');
            expect(serializePostgresDateAsUTC(new Date('0005-01-01T00:00:00.000Z'))).toEqual('0005-01-01T00:00:00.000+00:00');
        });

        it('should mark years before 1 as BC', () => {
            const date = new Date('2026-01-01T00:00:00.000Z');
            date.setUTCFullYear(-4);

            expect(serializePostgresDateAsUTC(date)).toEqual('0005-01-01T00:00:00.000+00:00 BC');
        });
    });

    describe('createPostgresUTCClient', () => {
        class Recorder {
            calls : unknown[][] = [];

            query(...args: unknown[]) {
                this.calls.push(args);
                return 'result';
            }
        }

        const date = new Date('2026-09-22T21:05:49.850Z');
        const utc = '2026-09-22T21:05:49.850+00:00';

        it('should send Date values as UTC, nested arrays included', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const callback = () => undefined;

            expect(client.query('SELECT $1, $2, $3', [date, [date, 1], 'x'], callback)).toEqual('result');
            expect(client.calls[0]).toEqual(['SELECT $1, $2, $3', [utc, [utc, 1], 'x'], callback]);
        });

        it('should send the values of a config object as UTC', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const config = { text: 'SELECT $1', values: [date] };

            client.query(config);
            expect(client.calls[0][0]).toEqual({ text: 'SELECT $1', values: [utc] });
        });

        it('should pass a query without values through', () => {
            const client = new (createPostgresUTCClient(Recorder))();
            const callback = () => undefined;

            client.query('SELECT 1', callback);
            expect(client.calls[0]).toEqual(['SELECT 1', callback, undefined]);
        });
    });

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

    describe('withDataSourceTimezone', () => {
        it('should pin postgres sessions and install the parser', () => {
            const options = withDataSourceTimezone({
                type: 'postgres',
                extra: { max: 3, options: '-c statement_timeout=5000' },
            }, 'UTC') as DataSourceOptions & Extra;

            expect(options.extra.max).toEqual(3);
            expect(options.extra.options).toEqual('-c statement_timeout=5000 -c TimeZone=UTC');
            expect(options.extra.types.getTypeParser(1114, 'text')('2026-01-01 00:00:00'))
                .toEqual(new Date('2026-01-01T00:00:00.000Z'));
        });

        it('should build on a given postgres driver', () => {
            const parser = (value: string) => value;
            class Client {}
            const driver = { types: { getTypeParser: () => parser }, Client };
            const options = withDataSourceTimezone({ type: 'postgres', driver }, 'UTC') as DataSourceOptions & Extra;

            expect(options.extra.types.getTypeParser(23, 'text')).toBe(parser);
            expect(new options.extra.Client()).toBeInstanceOf(Client);
        });

        it('should subclass the pg-native client when typeorm would use it', () => {
            class Client {}
            class NativeClient {}
            const driver = {
                types: pg.types, 
                Client, 
                native: { Client: NativeClient }, 
            };

            const native = withDataSourceTimezone({
                type: 'postgres', 
                driver, 
                nativeDriver: {}, 
            }, 'UTC') as DataSourceOptions & Extra;
            expect(new native.extra.Client()).toBeInstanceOf(NativeClient);

            const plain = withDataSourceTimezone({
                type: 'postgres', 
                driver, 
                nativeDriver: null, 
            }, 'UTC') as DataSourceOptions & Extra;
            expect(new plain.extra.Client()).toBeInstanceOf(Client);
        });

        it.each(['mysql', 'mariadb'] as const)('should pin %s sessions and read as UTC', (type) => {
            const options = withDataSourceTimezone({ type }, 'UTC') as DataSourceOptions & { driver: any };

            expect(options).toMatchObject({ timezone: 'Z' });
            expect(typeof options.driver.createPool).toEqual('function');
        });

        it('should wrap a given mysql driver', () => {
            const { pool } = { pool: { on: () => undefined } };
            const driver = { createPool: () => pool };
            const options = withDataSourceTimezone({ type: 'mysql', driver }, 'UTC') as DataSourceOptions & { driver: any };

            expect(options.driver).not.toBe(driver);
            expect(options.driver.createPool()).toBe(pool);
        });

        it('should leave explicit settings, replication and other drivers alone', () => {
            const cases : DataSourceOptions[] = [
                { type: 'mysql', timezone: '+02:00' },
                { type: 'mysql', replication: { master: {}, slaves: [] } },
                { type: 'postgres', extra: { options: '-c timezone=Europe/Berlin' } },
                { type: 'postgres', extra: { types: { getTypeParser: () => (value: string) => value } } },
                { type: 'postgres', extra: { Client: class {} } },
                { type: 'oracle', extra: { sessionCallback: () => undefined } },
                { type: 'cockroachdb', timeTravelQueries: false },
                { type: 'mssql' },
                { type: 'better-sqlite3', database: ':memory:' },
            ];

            // all or nothing: half a pin shifts values instead of fixing them
            for (const input of cases) {
                expect(withDataSourceTimezone(input, 'UTC')).toBe(input);
            }
        });

        it('should pin oracle sessions and wrap the driver', () => {
            const driver = { DB_TYPE_TIMESTAMP: 'ts', createPool: () => undefined };
            const options = withDataSourceTimezone({
                type: 'oracle', 
                driver, 
                extra: { poolMax: 2 }, 
            }, 'UTC') as DataSourceOptions & Extra & { driver: any };

            expect(options.extra.poolMax).toEqual(2);
            expect(options.driver).not.toBe(driver);

            const executed : string[] = [];
            let done : unknown = 'pending';
            options.extra.sessionCallback({
                execute: (sql: string, callback: (err: unknown) => void) => {
                    executed.push(sql);
                    callback(null);
                },
            }, '', (err?: unknown) => { done = err; });

            expect(executed).toEqual(['ALTER SESSION SET TIME_ZONE = \'+00:00\'']);
            expect(done).toBeUndefined();
        });

        it('should match only a TimeZone assignment among the startup options', () => {
            const pinned = (startup: string) => (withDataSourceTimezone({
                type: 'postgres',
                extra: { options: startup },
            }, 'UTC') as DataSourceOptions & Extra).extra.options;

            // other settings which merely mention a timezone
            expect(pinned('-c log_timezone=Europe/Berlin')).toEqual('-c log_timezone=Europe/Berlin -c TimeZone=UTC');
            expect(pinned('-c search_path=timezone')).toEqual('-c search_path=timezone -c TimeZone=UTC');

            // the setting itself, in both spellings, is left alone
            expect(pinned('-c TimeZone=Europe/Berlin')).toEqual('-c TimeZone=Europe/Berlin');
            expect(pinned('-ctimezone=UTC')).toEqual('-ctimezone=UTC');
            expect(pinned('--timezone=UTC')).toEqual('--timezone=UTC');
        });

        it('should be idempotent', () => {
            const once = withDataSourceTimezone({ type: 'postgres' }, 'UTC') as DataSourceOptions & Extra;
            const twice = withDataSourceTimezone(once, 'UTC') as DataSourceOptions & Extra;

            expect(twice.extra.options).toEqual('-c TimeZone=UTC');
            expect(twice.extra.types).toBe(once.extra.types);

            const mysql = withDataSourceTimezone({ type: 'mysql' }, 'UTC');
            expect(withDataSourceTimezone(mysql, 'UTC')).toBe(mysql);

            const oracle = withDataSourceTimezone({ type: 'oracle', driver: { createPool: () => undefined } }, 'UTC');
            expect(withDataSourceTimezone(oracle, 'UTC')).toBe(oracle);
        });

        it('should refuse a timezone other than UTC', () => {
            expect(() => withDataSourceTimezone({ type: 'postgres' }, 'Europe/Berlin' as 'UTC'))
                .toThrow(OptionsError);
        });
    });

    describe('DB_TIMEZONE', () => {
        it('should apply to options read from the env', () => {
            process.env[EnvironmentVariableName.URL] = 'mysql://admin:start123@localhost:3306';
            process.env[EnvironmentVariableName.TIMEZONE] = 'utc';

            expect(readDataSourceOptionsFromEnv()).toMatchObject({ type: 'mysql', timezone: 'Z' });
        });

        it('should apply once, after merging with the env', () => {
            process.env[EnvironmentVariableName.TYPE] = 'postgres';
            process.env[EnvironmentVariableName.TIMEZONE] = 'UTC';

            const options = mergeDataSourceOptionsWithEnv({
                type: 'postgres',
                extra: { max: 3 },
            }) as DataSourceOptions & Extra;

            expect(options.extra.max).toEqual(3);
            expect(options.extra.options).toEqual('-c TimeZone=UTC');
        });

        it('should apply to options without an env driver type', () => {
            process.env[EnvironmentVariableName.TIMEZONE] = 'UTC';

            expect(mergeDataSourceOptionsWithEnv({ type: 'mysql' })).toMatchObject({ timezone: 'Z' });
        });

        it('should leave options alone without it', () => {
            const input : DataSourceOptions = { type: 'mysql' };
            expect(mergeDataSourceOptionsWithEnv(input)).toBe(input);
        });

        it('should refuse an unsupported value', () => {
            process.env[EnvironmentVariableName.URL] = 'mysql://admin:start123@localhost:3306';
            process.env[EnvironmentVariableName.TIMEZONE] = 'Europe/Berlin';

            expect(() => readDataSourceOptionsFromEnv()).toThrow(OptionsError);
        });
    });
});
