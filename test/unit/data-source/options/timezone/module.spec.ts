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
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
    resetEnv,
    withDataSourceTimezone,
} from '../../../../../src';

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
