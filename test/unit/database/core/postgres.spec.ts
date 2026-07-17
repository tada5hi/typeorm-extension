import {
    PostgresDialect,
    buildPostgresCreateDatabaseQuery,
} from '../../../../src/database/core';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core/postgres', () => {
    it('should create database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE "app"']);
        expect(connectionFactory.events[0]).toEqual({
            type: 'open', 
            connection: 1, 
            database: 'postgres', 
        });
        expect(connectionFactory.openConnections.size).toEqual(0);
        expect(output).toEqual({ ok: true });
    });

    it('should check existence before creation', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.statements()).toEqual([
            "SELECT * FROM pg_database WHERE lower(datname) = lower('app');",
            'CREATE DATABASE "app"',
        ]);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should skip creation when the database exists', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory(
            (sql) => (sql.startsWith('SELECT') ? { rows: [{ datname: 'app' }] } : { ok: true }),
        );
        const dialect = new PostgresDialect(connectionFactory);

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.statements()).toHaveLength(1);
        expect(connectionFactory.openConnections.size).toEqual(0);
        expect(output).toBeUndefined();
    });

    it('should create schema on a second connection targeting the new database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app', schema: 'tenant' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        });

        expect(connectionFactory.statements()).toEqual([
            'CREATE DATABASE "app"',
            'CREATE SCHEMA IF NOT EXISTS "tenant"',
        ]);
        expect(connectionFactory.eventTypes()).toEqual([
            'open', 
            'execute', 
            'close',
            'open', 
            'execute', 
            'close',
        ]);
        expect(connectionFactory.events[0]).toEqual({
            type: 'open', 
            connection: 1, 
            database: 'postgres', 
        });
        expect(connectionFactory.events[3]).toEqual({
            type: 'open', 
            connection: 2, 
            database: 'app', 
        });
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should not create the public schema', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app', schema: 'public' },
            ifNotExist: false,
        });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE "app"']);
    });

    it('should close the connection when the query fails', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory(() => {
            throw new Error('boom');
        });
        const dialect = new PostgresDialect(connectionFactory);

        await expect(dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        })).rejects.toThrow('boom');

        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should drop database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connectionFactory.statements()).toEqual(['DROP DATABASE IF EXISTS "app"']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should drop database without exist guard', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new PostgresDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: false,
        });

        expect(connectionFactory.statements()).toEqual(['DROP DATABASE "app"']);
    });

    it('should build create query with template and encoding', () => {
        expect(buildPostgresCreateDatabaseQuery({ database: 'app', template: 'template0' }))
            .toEqual('CREATE DATABASE "app" TEMPLATE "template0"');

        expect(buildPostgresCreateDatabaseQuery({ database: 'app', characterSet: 'UTF8' }))
            .toEqual('CREATE DATABASE "app" WITH ENCODING \'UTF8\'');

        expect(buildPostgresCreateDatabaseQuery({
            database: 'app', 
            template: 'template0', 
            characterSet: 'UTF8',
        })).toEqual('CREATE DATABASE "app" TEMPLATE "template0"');
    });
});
