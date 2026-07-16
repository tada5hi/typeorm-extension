import {
    PostgresDialect,
    buildPostgresCreateDatabaseQuery,
} from '../../../../src/database/core';
import { MemoryDatabaseServer, createMemoryRuntime } from '../../../data/database';

describe('src/database/core/postgres', () => {
    it('should create database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['CREATE DATABASE "app"']);
        expect(server.events[0]).toEqual({ type: 'connect', session: 1, database: 'postgres' });
        expect(server.openSessions.size).toEqual(0);
        expect(output).toEqual({ ok: true });
    });

    it('should check existence before creation', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            "SELECT * FROM pg_database WHERE lower(datname) = lower('app');",
            'CREATE DATABASE "app"',
        ]);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should skip creation when the database exists', async () => {
        const server = new MemoryDatabaseServer(
            (sql) => (sql.startsWith('SELECT') ? { rows: [{ datname: 'app' }] } : { ok: true }),
        );
        const dialect = new PostgresDialect();

        const output = await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toHaveLength(1);
        expect(server.openSessions.size).toEqual(0);
        expect(output).toBeUndefined();
    });

    it('should create schema on a second session targeting the new database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        await dialect.create({
            params: { database: 'app', schema: 'tenant' },
            ifNotExist: false,
            initialDatabase: 'postgres',
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'CREATE DATABASE "app"',
            'CREATE SCHEMA IF NOT EXISTS "tenant"',
        ]);
        expect(server.eventTypes()).toEqual([
            'connect', 'execute', 'close',
            'connect', 'execute', 'close',
        ]);
        expect(server.events[0]).toEqual({ type: 'connect', session: 1, database: 'postgres' });
        expect(server.events[3]).toEqual({ type: 'connect', session: 2, database: 'app' });
        expect(server.openSessions.size).toEqual(0);
    });

    it('should not create the public schema', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        await dialect.create({
            params: { database: 'app', schema: 'public' },
            ifNotExist: false,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['CREATE DATABASE "app"']);
    });

    it('should close the session when the query fails', async () => {
        const server = new MemoryDatabaseServer(() => {
            throw new Error('boom');
        });
        const dialect = new PostgresDialect();

        await expect(dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        }, createMemoryRuntime({ server }))).rejects.toThrow('boom');

        expect(server.openSessions.size).toEqual(0);
    });

    it('should drop database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['DROP DATABASE IF EXISTS "app"']);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should drop database without exist guard', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new PostgresDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: false,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['DROP DATABASE "app"']);
    });

    it('should build create query with template and encoding', () => {
        expect(buildPostgresCreateDatabaseQuery({ database: 'app', template: 'template0' }))
            .toEqual('CREATE DATABASE "app" TEMPLATE "template0"');

        expect(buildPostgresCreateDatabaseQuery({ database: 'app', characterSet: 'UTF8' }))
            .toEqual('CREATE DATABASE "app" WITH ENCODING \'UTF8\'');

        expect(buildPostgresCreateDatabaseQuery({
            database: 'app', template: 'template0', characterSet: 'UTF8',
        })).toEqual('CREATE DATABASE "app" TEMPLATE "template0"');
    });
});
