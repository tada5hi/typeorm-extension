import {readDataSourceOptionsFromEnv} from "../../../src";
import {EnvironmentVariableName, resetEnv, useEnv} from "../../../src/env";

describe('src/env/**', () => {
    it('should reuse env instance', () => {
        resetEnv();

        let env = useEnv();
        expect(env).toBeDefined();
        expect(env).toEqual(useEnv());

        resetEnv();
    });

    it('should handle extra env parameter', () => {
        resetEnv();

        let ob : Record<string, any> = {
            foo: 'bar'
        }
        process.env = {
            ...process.env,
            [EnvironmentVariableName.TYPE]: 'better-sqlite3',
            [EnvironmentVariableName.DRIVER_EXTRA]: JSON.stringify(ob)
        };

        const options = readDataSourceOptionsFromEnv();
        expect(options).toBeDefined();
        if(options) {
            expect(options.extra).toBeDefined()
            expect(options.extra).toEqual(ob);
        }

        delete process.env[EnvironmentVariableName.TYPE];
        delete process.env[EnvironmentVariableName.DRIVER_EXTRA];

        resetEnv()
    });

    it('should use url to determine type', () => {
        resetEnv();

        process.env = {
            ...process.env,
            [EnvironmentVariableName.URL]: 'mysql://admin:start123@localhost:3306',
        };

        const options = readDataSourceOptionsFromEnv();
        expect(options).toBeDefined();
        if(options) {
            expect(options.type).toEqual('mysql');
        }

        delete process.env[EnvironmentVariableName.URL];

        resetEnv();
    })
})
