import { CockroachDBDialect } from '../../../../src/database/core';
import { MemoryDatabaseConnector } from '../../../data/database';

describe('src/database/core/cockroachdb', () => {
    it('should create database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new CockroachDBDialect(connector);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connector.sql()).toEqual(['CREATE DATABASE IF NOT EXISTS  "app"']);
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should create database without exist guard', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new CockroachDBDialect(connector);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        });

        expect(connector.sql()).toEqual(['CREATE DATABASE  "app"']);
    });

    it('should drop database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new CockroachDBDialect(connector);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connector.sql()).toEqual(['DROP DATABASE IF EXISTS  "app"']);
        expect(connector.openSessions.size).toEqual(0);
    });
});
