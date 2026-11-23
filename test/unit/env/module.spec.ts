import { describe, expect, it } from 'vitest';
import { readDataSourceOptionsFromEnv } from '../../../src';
import { EnvironmentVariableName, resetEnv, useEnv } from '../../../src/env';

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
        resetEnv();

        process.env[EnvironmentVariableName.SYNCHRONIZE] = 'TRUE';
        process.env[EnvironmentVariableName.MIGRATIONS_RUN] = ' False ';
        process.env[EnvironmentVariableName.LOGGING] = ' true';

        try {
            expect(useEnv('synchronize')).toBe(true);
            expect(useEnv('migrationsRun')).toBe(false);
            expect(useEnv('logging')).toBe(true);
        } finally {
            delete process.env[EnvironmentVariableName.SYNCHRONIZE];
            delete process.env[EnvironmentVariableName.MIGRATIONS_RUN];
            delete process.env[EnvironmentVariableName.LOGGING];

            resetEnv();
        }
    });

    it('should prefer a variable over its alias', () => {
        resetEnv();

        process.env[EnvironmentVariableName.HOST] = 'primary';
        process.env[EnvironmentVariableName.HOST_ALT] = 'alias';
        process.env[EnvironmentVariableName.ENTITIES_ALT] = 'src/entities/*.ts';
        process.env[EnvironmentVariableName.PORT] = 'abc';
        process.env[EnvironmentVariableName.PORT_ALT] = '5432';

        try {
            expect(useEnv('host')).toEqual('primary');
            expect(useEnv('entities')).toEqual(['src/entities/*.ts']);
            // a set value that does not parse does not fall back to the alias
            expect(useEnv('port')).toBeUndefined();
        } finally {
            delete process.env[EnvironmentVariableName.HOST];
            delete process.env[EnvironmentVariableName.HOST_ALT];
            delete process.env[EnvironmentVariableName.ENTITIES_ALT];
            delete process.env[EnvironmentVariableName.PORT];
            delete process.env[EnvironmentVariableName.PORT_ALT];

            resetEnv();
        }
    });
});
