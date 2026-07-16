import {
    PostgresDialect,
    buildPostgresCreateDatabaseQuery,
} from '../../../../src/database/core';
import { MemoryDatabaseConnector } from '../../../data/database';

describe('src/database/core/postgres', () => {
    it('should create database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        });

        expect(connector.sql()).toEqual(['CREATE DATABASE "app"']);
        expect(connector.events[0]).toEqual({
            type: 'open', 
            session: 1, 
            database: 'postgres', 
        });
        expect(connector.openSessions.size).toEqual(0);
        expect(output).toEqual({ ok: true });
    });

    it('should check existence before creation', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connector.sql()).toEqual([
            "SELECT * FROM pg_database WHERE lower(datname) = lower('app');",
            'CREATE DATABASE "app"',
        ]);
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should skip creation when the database exists', async () => {
        const connector = new MemoryDatabaseConnector(
            (sql) => (sql.startsWith('SELECT') ? { rows: [{ datname: 'app' }] } : { ok: true }),
        );
        const dialect = new PostgresDialect(connector);

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connector.sql()).toHaveLength(1);
        expect(connector.openSessions.size).toEqual(0);
        expect(output).toBeUndefined();
    });

    it('should create schema on a second session targeting the new database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        await dialect.create({
            params: { database: 'app', schema: 'tenant' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        });

        expect(connector.sql()).toEqual([
            'CREATE DATABASE "app"',
            'CREATE SCHEMA IF NOT EXISTS "tenant"',
        ]);
        expect(connector.eventTypes()).toEqual([
            'open', 
            'execute', 
            'close',
            'open', 
            'execute', 
            'close',
        ]);
        expect(connector.events[0]).toEqual({
            type: 'open', 
            session: 1, 
            database: 'postgres', 
        });
        expect(connector.events[3]).toEqual({
            type: 'open', 
            session: 2, 
            database: 'app', 
        });
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should not create the public schema', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        await dialect.create({
            params: { database: 'app', schema: 'public' },
            ifNotExist: false,
        });

        expect(connector.sql()).toEqual(['CREATE DATABASE "app"']);
    });

    it('should close the session when the query fails', async () => {
        const connector = new MemoryDatabaseConnector(() => {
            throw new Error('boom');
        });
        const dialect = new PostgresDialect(connector);

        await expect(dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        })).rejects.toThrow('boom');

        expect(connector.openSessions.size).toEqual(0);
    });

    it('should drop database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connector.sql()).toEqual(['DROP DATABASE IF EXISTS "app"']);
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should drop database without exist guard', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new PostgresDialect(connector);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: false,
        });

        expect(connector.sql()).toEqual(['DROP DATABASE "app"']);
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
