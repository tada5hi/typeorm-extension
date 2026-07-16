import { MsSQLDialect } from '../../../../src/database/core';
import { MemoryDatabaseServer, createMemoryRuntime } from '../../../data/database';

describe('src/database/core/mssql', () => {
    it('should create database with DB_ID guard', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MsSQLDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'IF DB_ID(\'app\') IS NULL CREATE DATABASE "app"',
        ]);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should create database with character set', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MsSQLDialect();

        await dialect.create({
            params: { database: 'app', characterSet: 'UTF8' },
            ifNotExist: false,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'CREATE DATABASE "app" CHARACTER SET UTF8',
        ]);
    });

    it('should drop database with DB_ID guard', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MsSQLDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'IF DB_ID(\'app\') IS NOT NULL DROP DATABASE "app"',
        ]);
        expect(server.openSessions.size).toEqual(0);
    });
});
