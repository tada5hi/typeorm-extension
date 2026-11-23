import { describe, expect, it } from 'vitest';
import { readDataSourceOptionsFromEnv } from '../../../src';
import { EnvironmentVariableName, resetEnv, useEnv } from '../../../src/env';

/**
 * Run fn with the given variables set (undefined: unset), restoring
 * their previous values and the env cache afterwards.
 */
function withEnv(variables: Record<string, string | undefined>, fn: () => void) {
    const previous : Record<string, string | undefined> = {};
    const assign = (key: string, value: string | undefined) => {
        if (typeof value === 'undefined') {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    };

    for (const [key, value] of Object.entries(variables)) {
        previous[key] = process.env[key];
        assign(key, value);
    }

    resetEnv();

    try {
        fn();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            assign(key, value);
        }

        resetEnv();
    }
}

describe('src/env/**', () => {
    it('should reuse env instance', () => {
        resetEnv();

        const env = useEnv();

        expect(env).toBeDefined();
        expect(env).toEqual(useEnv());

        resetEnv();
    });

    it('should handle extra env parameter', () => {
        resetEnv();

        const ob : Record<string, any> = { foo: 'bar' };

        process.env = {
            ...process.env,
            [EnvironmentVariableName.TYPE]: 'better-sqlite3',
            [EnvironmentVariableName.DRIVER_EXTRA]: JSON.stringify(ob),
        };

        const options = readDataSourceOptionsFromEnv();

        expect(options).toBeDefined();

        if (options) {
            expect(options.extra).toBeDefined();
            expect(options.extra).toEqual(ob);
        }

        delete process.env[EnvironmentVariableName.TYPE];
        delete process.env[EnvironmentVariableName.DRIVER_EXTRA];

        resetEnv();
    });

    it('should use url to determine type', () => {
        resetEnv();

        process.env = {
            ...process.env,
            [EnvironmentVariableName.URL]: 'mysql://admin:start123@localhost:3306',
        };

        const options = readDataSourceOptionsFromEnv();

        expect(options).toBeDefined();

        if (options) {
            expect(options.type).toEqual('mysql');
        }

        delete process.env[EnvironmentVariableName.URL];

        resetEnv();
    });

    it('should read boolean words case-insensitively and trimmed', () => {
        withEnv({
            [EnvironmentVariableName.SYNCHRONIZE]: 'TRUE',
            [EnvironmentVariableName.MIGRATIONS_RUN]: ' False ',
            [EnvironmentVariableName.LOGGING]: ' true',
        }, () => {
            expect(useEnv('synchronize')).toBe(true);
            expect(useEnv('migrationsRun')).toBe(false);
            expect(useEnv('logging')).toBe(true);
        });
    });

    it('should read ints strictly', () => {
        withEnv({
            [EnvironmentVariableName.PORT]: '5432abc',
            [EnvironmentVariableName.PORT_ALT]: undefined,
            [EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME]: ' 250 ',
        }, () => {
            expect(useEnv('port')).toBeUndefined();
            expect(useEnv('maxQueryExecutionTime')).toBe(250);
        });
    });

    it('should prefer a variable over its alias', () => {
        withEnv({
            [EnvironmentVariableName.HOST]: 'primary',
            [EnvironmentVariableName.HOST_ALT]: 'alias',
            [EnvironmentVariableName.ENTITIES]: undefined,
            [EnvironmentVariableName.ENTITIES_ALT]: 'src/entities/*.ts',
            [EnvironmentVariableName.PORT]: 'abc',
            [EnvironmentVariableName.PORT_ALT]: '5432',
        }, () => {
            expect(useEnv('host')).toEqual('primary');
            expect(useEnv('entities')).toEqual(['src/entities/*.ts']);
            // a set value that does not parse does not fall back to the alias
            expect(useEnv('port')).toBeUndefined();
        });
    });
});
