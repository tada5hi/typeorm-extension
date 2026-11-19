import type { DataSourceOptions } from 'typeorm';
import {
    EnvironmentVariableName,
    OptionsError,
    assertEnvDataSourceOptions,
    buildDataSourceOptions,
    hasEnvDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
    resetEnv,
    useEnv,
} from '../../../../src';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import { User } from '../../../data/entity/user';

describe('src/data-source/options/env', () => {
    it('should read env data-source options', () => {
        process.env[
            EnvironmentVariableName.URL
        ] = 'mysql://admin:start123@localhost:3306';

        expect(hasEnvDataSourceOptions()).toEqual(true);

        const env = readDataSourceOptionsFromEnv();

        expect(env).toBeDefined();

        if (env) {
            expect(env.type).toEqual('mysql');

            if (env.type === 'mysql') {
                expect(env.url).toEqual('mysql://admin:start123@localhost:3306');
            } else {
                expect(true).toEqual(false);
            }
        }

        delete process.env[EnvironmentVariableName.URL];

        resetEnv();
    });

    it('should merge data-source options', () => {
        let options : DataSourceOptions = {
            type: 'better-sqlite3',
            entities: [User],
            database: ':memory:',
            extra: { charset: 'UTF8_GENERAL_CI' },
        };

        process.env = {
            ...process.env,
            [EnvironmentVariableName.TYPE]: 'better-sqlite3',
            [EnvironmentVariableName.DATABASE]: 'db.sqlite',
        };

        options = mergeDataSourceOptionsWithEnv(options);

        expect(options.type).toEqual('better-sqlite3');
        expect(options.database).toEqual('db.sqlite');

        resetEnv();
    });

    it('should build data-source options with experimental option', async () => {
        process.env = {
            ...process.env,
            [EnvironmentVariableName.TYPE]: 'better-sqlite3',
            [EnvironmentVariableName.DATABASE]: 'test.sqlite',
        };

        const options = await buildDataSourceOptions({ directory: 'test/data/typeorm' });

        expect(options).toBeDefined();
        expect(options.type).toEqual('better-sqlite3');
        expect(options.database).toEqual('test.sqlite');

        delete process.env[EnvironmentVariableName.TYPE];
        delete process.env[EnvironmentVariableName.DATABASE];

        resetEnv();
    });

    it('should not read from env', () => {
        const options = readDataSourceOptionsFromEnv();

        expect(options).toBeUndefined();
    });

    describe('unset variables over file options', () => {
        const names = [
            EnvironmentVariableName.TYPE,
            EnvironmentVariableName.DATABASE,
            EnvironmentVariableName.LOGGING,
            EnvironmentVariableName.LOGGING_ALT,
        ];

        afterEach(() => {
            for (const name of names) {
                delete process.env[name];
            }

            resetEnv();
        });

        it('should leave logging unset without DB_LOGGING', () => {
            resetEnv();

            expect(useEnv('logging')).toBeUndefined();
        });

        it('should keep the logging and database of the file', () => {
            process.env[EnvironmentVariableName.TYPE] = 'better-sqlite3';
            resetEnv();

            const options = mergeDataSourceOptionsWithEnv({
                type: 'better-sqlite3',
                database: ':memory:',
                logging: true,
            });

            expect(options.logging).toEqual(true);
            expect(options.database).toEqual(':memory:');
        });

        it('should let a set DB_LOGGING win over the file', () => {
            process.env[EnvironmentVariableName.TYPE] = 'better-sqlite3';
            process.env[EnvironmentVariableName.LOGGING] = 'false';
            resetEnv();

            const options = mergeDataSourceOptionsWithEnv({
                type: 'better-sqlite3',
                database: ':memory:',
                logging: true,
            });

            expect(options.logging).toEqual(false);
        });

        it('should read a DB_LOGGING list', () => {
            process.env[EnvironmentVariableName.LOGGING_ALT] = 'query, error';
            resetEnv();

            expect(useEnv('logging')).toEqual(['query', 'error']);
        });

        it('should default the better-sqlite3 database without a file value', () => {
            process.env[EnvironmentVariableName.TYPE] = 'better-sqlite3';
            resetEnv();

            expect(readDataSourceOptionsFromEnv()?.database).toEqual('db.sqlite');
            expect(mergeDataSourceOptionsWithEnv({ type: 'better-sqlite3' } as DataSourceOptions).database)
                .toEqual('db.sqlite');
        });

        it('should keep the timeTravelQueries of the file', () => {
            process.env[EnvironmentVariableName.TYPE] = 'cockroachdb';
            resetEnv();

            const env = readDataSourceOptionsFromEnv();

            expect(env && env.type === 'cockroachdb' && env.timeTravelQueries).toEqual(true);

            const options = mergeDataSourceOptionsWithEnv({
                type: 'cockroachdb',
                timeTravelQueries: false,
            });

            expect(options.type === 'cockroachdb' && options.timeTravelQueries).toEqual(false);
        });
    });

    describe('env checks', () => {
        const names = [
            EnvironmentVariableName.TYPE,
            EnvironmentVariableName.URL,
            EnvironmentVariableName.HOST,
            EnvironmentVariableName.PORT,
            EnvironmentVariableName.USERNAME,
            EnvironmentVariableName.PASSWORD,
            EnvironmentVariableName.DATABASE,
            EnvironmentVariableName.SID,
            EnvironmentVariableName.HOST_ALT,
            EnvironmentVariableName.DATABASE_ALT,
        ];

        function setEnv(values: Record<string, string>) {
            Object.assign(process.env, values);
            resetEnv();
        }

        afterEach(() => {
            for (const name of names) {
                delete process.env[name];
            }

            resetEnv();
        });

        describe('hasEnvDataSourceOptions', () => {
            it('should be false for an empty environment', () => {
                expect(hasEnvDataSourceOptions()).toEqual(false);
                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(false);
            });

            it('should need only a driver, unless strict', () => {
                setEnv({ [EnvironmentVariableName.TYPE]: 'postgres' });

                expect(hasEnvDataSourceOptions()).toEqual(true);
                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(false);
            });

            it('should be true when strict for a driver and a connection setting', () => {
                setEnv({
                    [EnvironmentVariableName.TYPE]: 'postgres',
                    [EnvironmentVariableName.HOST]: 'localhost',
                });

                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(true);
            });

            it('should take the driver from the scheme of the url', () => {
                setEnv({ [EnvironmentVariableName.URL]: 'postgres://localhost:5432/app' });

                expect(hasEnvDataSourceOptions()).toEqual(true);
                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(true);
            });

            it('should take no driver from a url without a scheme', () => {
                setEnv({ [EnvironmentVariableName.URL]: 'localhost:5432/app' });

                expect(hasEnvDataSourceOptions()).toEqual(false);
                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(false);
                expect(readDataSourceOptionsFromEnv()).toBeUndefined();
            });

            it('should never throw for connection settings without a driver', () => {
                setEnv({ [EnvironmentVariableName.HOST]: 'localhost' });

                expect(hasEnvDataSourceOptions()).toEqual(false);
                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(false);
            });

            it('should treat an empty value as unset', () => {
                setEnv({
                    [EnvironmentVariableName.TYPE]: 'postgres',
                    [EnvironmentVariableName.HOST]: '',
                    [EnvironmentVariableName.PASSWORD]: '',
                });

                expect(hasEnvDataSourceOptions({ strict: true })).toEqual(false);
            });
        });

        describe('assertEnvDataSourceOptions', () => {
            it('should accept an empty environment, unless required', () => {
                expect(() => assertEnvDataSourceOptions()).not.toThrow();
                expect(() => assertEnvDataSourceOptions({ required: true })).toThrow(OptionsError);
            });

            it('should accept a driver, required or not', () => {
                setEnv({ [EnvironmentVariableName.TYPE]: 'better-sqlite3' });

                expect(() => assertEnvDataSourceOptions()).not.toThrow();
                expect(() => assertEnvDataSourceOptions({ required: true })).not.toThrow();
            });

            it.each([
                [EnvironmentVariableName.HOST, 'localhost'],
                [EnvironmentVariableName.PORT, '5432'],
                [EnvironmentVariableName.USERNAME, 'admin'],
                [EnvironmentVariableName.PASSWORD, 'start123'],
                [EnvironmentVariableName.DATABASE, 'app'],
                [EnvironmentVariableName.SID, 'xe'],
            ])('should refuse %s without a driver', (name, value) => {
                setEnv({ [name]: value });

                expect(() => assertEnvDataSourceOptions()).toThrow(OptionsError);
                expect(() => assertEnvDataSourceOptions()).toThrow(name);
            });

            it('should refuse a url without a scheme, required or not', () => {
                setEnv({ [EnvironmentVariableName.URL]: 'localhost:5432/app' });

                expect(() => assertEnvDataSourceOptions()).toThrow(EnvironmentVariableName.URL);
                expect(() => assertEnvDataSourceOptions({ required: true })).toThrow(EnvironmentVariableName.URL);
            });

            it('should name the DB_* variable when its alias is set', () => {
                setEnv({
                    [EnvironmentVariableName.HOST_ALT]: 'localhost',
                    [EnvironmentVariableName.DATABASE_ALT]: 'app',
                });

                expect(() => assertEnvDataSourceOptions()).toThrow(
                    `${EnvironmentVariableName.HOST}, ${EnvironmentVariableName.DATABASE}`,
                );
            });

            it('should treat an empty value as unset', () => {
                setEnv({ [EnvironmentVariableName.HOST]: '' });

                expect(() => assertEnvDataSourceOptions()).not.toThrow();
            });
        });
    });
});
