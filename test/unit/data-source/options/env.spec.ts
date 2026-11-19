import type { DataSourceOptions } from 'typeorm';
import {
    EnvironmentVariableName,
    buildDataSourceOptions,
    hasEnvDataSourceConnectionOptions,
    hasEnvDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
    resetEnv,
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

    describe('hasEnvDataSourceConnectionOptions', () => {
        const names = [
            EnvironmentVariableName.URL,
            EnvironmentVariableName.HOST,
            EnvironmentVariableName.PORT,
            EnvironmentVariableName.USERNAME,
            EnvironmentVariableName.PASSWORD,
            EnvironmentVariableName.DATABASE,
            EnvironmentVariableName.SID,
            EnvironmentVariableName.HOST_ALT,
            EnvironmentVariableName.DATABASE_ALT,
            EnvironmentVariableName.TYPE,
        ];

        afterEach(() => {
            for (const name of names) {
                delete process.env[name];
            }

            resetEnv();
        });

        it('should be false without connection settings', () => {
            expect(hasEnvDataSourceConnectionOptions()).toEqual(false);
        });

        it('should treat an empty variable as unset', () => {
            process.env[EnvironmentVariableName.HOST] = '';
            process.env[EnvironmentVariableName.PASSWORD] = '';

            expect(hasEnvDataSourceConnectionOptions()).toEqual(false);
        });

        it('should be false for a driver alone', () => {
            process.env[EnvironmentVariableName.TYPE] = 'postgres';

            expect(hasEnvDataSourceConnectionOptions()).toEqual(false);
            expect(hasEnvDataSourceOptions()).toEqual(true);
        });

        it.each([
            [EnvironmentVariableName.URL, 'postgres://localhost:5432/app'],
            [EnvironmentVariableName.HOST, 'localhost'],
            [EnvironmentVariableName.PORT, '5432'],
            [EnvironmentVariableName.USERNAME, 'admin'],
            [EnvironmentVariableName.PASSWORD, 'start123'],
            [EnvironmentVariableName.DATABASE, 'app'],
            [EnvironmentVariableName.SID, 'xe'],
            [EnvironmentVariableName.HOST_ALT, 'localhost'],
            [EnvironmentVariableName.DATABASE_ALT, 'app'],
        ])('should be true for %s', (name, value) => {
            process.env[name] = value;

            expect(hasEnvDataSourceConnectionOptions()).toEqual(true);
        });

        it('should tell connection settings without a driver apart', () => {
            process.env[EnvironmentVariableName.HOST] = 'localhost';

            expect(hasEnvDataSourceConnectionOptions()).toEqual(true);
            expect(hasEnvDataSourceOptions()).toEqual(false);
        });
    });
});
