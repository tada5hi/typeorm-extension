import { CockroachDBDialect } from '../../../../src/database/core';
import { MemoryDatabaseServer, createMemoryRuntime } from '../../../data/database';

describe('src/database/core/cockroachdb', () => {
    it('should create database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new CockroachDBDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['CREATE DATABASE IF NOT EXISTS  "app"']);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should create database without exist guard', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new CockroachDBDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['CREATE DATABASE  "app"']);
    });

    it('should drop database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new CockroachDBDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['DROP DATABASE IF EXISTS  "app"']);
        expect(server.openSessions.size).toEqual(0);
    });
});
