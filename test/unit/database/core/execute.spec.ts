import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../../../../src/errors';
import { createDatabase, dropDatabase } from '../../../../src/database';
import {
    executeDatabaseCreate,
    executeDatabaseDrop,
} from '../../../../src/database/methods/execute';
import { resolveDatabaseDialectName } from '../../../../src/database/registry';
import { MemoryDatabaseConnector } from '../../../data/database';

const options = {
    type: 'postgres',
    database: 'app',
} as DataSourceOptions;

describe('src/database/methods/execute', () => {
    it('should resolve dialect names', () => {
        expect(resolveDatabaseDialectName('postgres')).toEqual('postgres');
        expect(resolveDatabaseDialectName('mariadb')).toEqual('mysql');
        expect(resolveDatabaseDialectName('better-sqlite3')).toEqual('better-sqlite3');

        expect(() => resolveDatabaseDialectName('foo' as DataSourceOptions['type']))
            .toThrow(DriverError);
    });

    it('should execute create through the registry', async () => {
        const connector = new MemoryDatabaseConnector();

        await executeDatabaseCreate('postgres', {
            options,
            ifNotExist: false,
            synchronize: false,
        }, { connector });

        expect(connector.statements()).toEqual(['CREATE DATABASE "app"']);
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should execute drop through the registry', async () => {
        const connector = new MemoryDatabaseConnector();

        await executeDatabaseDrop('postgres', {
            options,
            ifExist: true,
        }, { connector });

        expect(connector.statements()).toEqual(['DROP DATABASE IF EXISTS "app"']);
    });

    it('should use a caller supplied connection and never close it', async () => {
        const executed: string[] = [];
        let closed = 0;

        await createDatabase({
            options,
            ifNotExist: false,
            synchronize: false,
            connection: {
                execute: async (sql: string) => {
                    executed.push(sql);
                    return { ok: true };
                },
                close: async () => {
                    closed += 1;
                },
            },
        });

        expect(executed).toEqual(['CREATE DATABASE "app"']);
        expect(closed).toEqual(0);
    });

    it('should drop through a caller supplied connection', async () => {
        const executed: string[] = [];

        await dropDatabase({
            options,
            connection: {
                execute: async (sql: string) => {
                    executed.push(sql);
                    return { ok: true };
                },
                close: async () => Promise.resolve(),
            },
        });

        expect(executed).toEqual(['DROP DATABASE IF EXISTS "app"']);
    });
});
