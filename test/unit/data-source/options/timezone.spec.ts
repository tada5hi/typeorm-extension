import type { DataSourceOptions } from 'typeorm';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import {
    EnvironmentVariableName,
    OptionsError,
    createMysqlUTCDriver,
    createPostgresUTCTypes,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
    resetEnv,
    withDataSourceTimezone,
} from '../../../../src';

type Extra = { extra: Record<string, any> };

const pg = PlatformTools.load('pg');

describe('src/data-source/options/timezone', () => {
    afterEach(() => {
        delete process.env[EnvironmentVariableName.TIMEZONE];
        delete process.env[EnvironmentVariableName.URL];
        delete process.env[EnvironmentVariableName.TYPE];
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

        it('should delegate postgres types to a given driver', () => {
            const parser = (value: string) => value;
            const driver = { types: { getTypeParser: () => parser } };
            const options = withDataSourceTimezone({ type: 'postgres', driver }, 'UTC') as DataSourceOptions & Extra;

            expect(options.extra.types.getTypeParser(23, 'text')).toBe(parser);
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
                { type: 'better-sqlite3', database: ':memory:' },
            ];

            for (const input of cases) {
                expect(withDataSourceTimezone(input, 'UTC')).toBe(input);
            }

            const types = { getTypeParser: () => (value: string) => value };
            const options = withDataSourceTimezone({
                type: 'postgres',
                extra: { types, options: '-c timezone=Europe/Berlin' },
            }, 'UTC') as DataSourceOptions & Extra;

            expect(options.extra.types).toBe(types);
            expect(options.extra.options).toEqual('-c timezone=Europe/Berlin');
        });

        it('should be idempotent', () => {
            const once = withDataSourceTimezone({ type: 'postgres' }, 'UTC') as DataSourceOptions & Extra;
            const twice = withDataSourceTimezone(once, 'UTC') as DataSourceOptions & Extra;

            expect(twice.extra.options).toEqual('-c TimeZone=UTC');
            expect(twice.extra.types).toBe(once.extra.types);

            const mysql = withDataSourceTimezone({ type: 'mysql' }, 'UTC');
            expect(withDataSourceTimezone(mysql, 'UTC')).toBe(mysql);
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
