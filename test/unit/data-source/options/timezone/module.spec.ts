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
    'PGOPTIONS',
    EnvironmentVariableName.PIN_TIMEZONE,
    EnvironmentVariableName.PIN_TIMEZONE_ALT,
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
        const oracle = {
            DB_TYPE_TIMESTAMP: 'ts',
            createPool: () => undefined,
        };

        it('should pin postgres, mysql, mariadb and oracle', () => {
            const postgres = withDataSourceTimezone({ type: 'postgres', driver: pg }, 'UTC') as DataSourceOptions & Extra;
            expect(postgres.extra.options).toEqual('-c TimeZone=UTC');

            for (const type of ['mysql', 'mariadb'] as const) {
                expect(withDataSourceTimezone({ type }, 'UTC')).toMatchObject({ timezone: 'Z', dateStrings: ['DATE'] });
            }

            const pinned = withDataSourceTimezone({ type: 'oracle', driver: oracle }, 'UTC') as DataSourceOptions & Extra;
            expect(typeof pinned.extra.sessionCallback).toEqual('function');
        });

        it('should leave drivers needing nothing untouched', () => {
            const cases : DataSourceOptions[] = [
                { type: 'cockroachdb', timeTravelQueries: false },
                { type: 'mssql' },
                { type: 'better-sqlite3', database: ':memory:' },
            ];

            for (const input of cases) {
                expect(withDataSourceTimezone(input, 'UTC')).toBe(input);
            }
        });

        it('should be idempotent', () => {
            const cases : DataSourceOptions[] = [
                { type: 'postgres', driver: pg },
                { type: 'mysql' },
                { type: 'oracle', driver: oracle },
            ];

            for (const input of cases) {
                const once = withDataSourceTimezone(input, 'UTC');
                expect(withDataSourceTimezone(once, 'UTC')).toBe(once);
            }
        });

        it('should refuse a timezone other than UTC', () => {
            expect(() => withDataSourceTimezone({ type: 'postgres' }, 'Europe/Berlin' as 'UTC'))
                .toThrow(OptionsError);
        });
    });

    describe('DB_PIN_TIMEZONE', () => {
        it('should apply to options read from the env', () => {
            process.env[EnvironmentVariableName.URL] = 'mysql://admin:start123@localhost:3306';
            process.env[EnvironmentVariableName.PIN_TIMEZONE] = 'utc';

            expect(readDataSourceOptionsFromEnv()).toMatchObject({ type: 'mysql', timezone: 'Z' });
        });

        it('should apply once, after merging with the env', () => {
            process.env[EnvironmentVariableName.TYPE] = 'postgres';
            process.env[EnvironmentVariableName.PIN_TIMEZONE] = 'UTC';

            const options = mergeDataSourceOptionsWithEnv({
                type: 'postgres',
                extra: { max: 3 },
            }) as DataSourceOptions & Extra;

            expect(options.extra.max).toEqual(3);
            expect(options.extra.options).toEqual('-c TimeZone=UTC');
        });

        it('should apply to options without an env driver type', () => {
            process.env[EnvironmentVariableName.PIN_TIMEZONE] = 'UTC';

            expect(mergeDataSourceOptionsWithEnv({ type: 'mysql' })).toMatchObject({ timezone: 'Z' });
        });

        it('should leave options alone without it', () => {
            const input : DataSourceOptions = { type: 'mysql' };
            expect(mergeDataSourceOptionsWithEnv(input)).toBe(input);
        });

        it('should refuse an unsupported value', () => {
            process.env[EnvironmentVariableName.URL] = 'mysql://admin:start123@localhost:3306';
            process.env[EnvironmentVariableName.PIN_TIMEZONE] = 'Europe/Berlin';

            expect(() => readDataSourceOptionsFromEnv()).toThrow(OptionsError);
        });
    });
});
