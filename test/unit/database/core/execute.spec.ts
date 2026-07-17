import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../../../../src/errors';
import { createDatabase, dropDatabase } from '../../../../src/database';
import {
    executeDatabaseCreate,
    executeDatabaseDrop,
} from '../../../../src/database/methods/execute';
import { resolveDatabaseDialectName } from '../../../../src/database/registry';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

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
        const connectionFactory = new MemoryDatabaseConnectionFactory();

        await executeDatabaseCreate('postgres', {
            options,
            ifNotExist: false,
            synchronize: false,
        }, { connectionFactory });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE "app"']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should execute drop through the registry', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();

        await executeDatabaseDrop('postgres', {
            options,
            ifExist: true,
        }, { connectionFactory });

        expect(connectionFactory.statements()).toEqual(['DROP DATABASE IF EXISTS "app"']);
    });

    it('should use a caller supplied connection and never close it', async () => {
        const executed: string[] = [];
        let closed = 0;

        // a full connection shaped object is accepted — only execute is required
        const connection = {
            execute: async (statement: string) => {
                executed.push(statement);
                return { ok: true };
            },
            close: async () => {
                closed += 1;
            },
        };

        await createDatabase({
            options,
            ifNotExist: false,
            synchronize: false,
            connection,
        });

        expect(executed).toEqual(['CREATE DATABASE "app"']);
        expect(closed).toEqual(0);
    });

    it('should drop through a caller supplied connection', async () => {
        const executed: string[] = [];

        await dropDatabase({
            options,
            connection: {
                execute: async (statement: string) => {
                    executed.push(statement);
                    return { ok: true };
                },
            },
        });

        expect(executed).toEqual(['DROP DATABASE IF EXISTS "app"']);
    });
});
