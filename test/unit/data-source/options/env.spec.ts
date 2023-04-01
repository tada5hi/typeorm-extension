import {DataSourceOptions} from "typeorm";
import {
    buildDataSourceOptions,
    hasEnvDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv
} from "../../../../src";
import {EnvironmentVariableName, resetEnv, } from "../../../../src/env";
import {User} from "../../../data/entity/user";

describe('src/data-source/options/env', function () {
    it('should read env data-source options', () => {
        process.env[
            EnvironmentVariableName.URL
            ] = 'mysql://admin:start123@localhost:3306';

        expect(hasEnvDataSourceOptions()).toEqual(true);

        const env = readDataSourceOptionsFromEnv();
        expect(env).toBeDefined();
        if(env) {
            expect(env.type).toEqual('mysql');
            if(env.type === 'mysql') {
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
            extra: {
                charset: "UTF8_GENERAL_CI"
            }
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

        const options = await buildDataSourceOptions({
            directory: 'test/data/typeorm',
            experimental: true
        });

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
    })
});
