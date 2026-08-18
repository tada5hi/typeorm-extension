import { describe, expect, it } from 'vitest';
import { CockroachDBDialect } from '../../../../src/database/core';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core/cockroachdb', () => {
    it('should create database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new CockroachDBDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE IF NOT EXISTS  "app"']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should create database without exist guard', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new CockroachDBDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: false,
        });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE  "app"']);
    });

    it('should drop database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new CockroachDBDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connectionFactory.statements()).toEqual(['DROP DATABASE IF EXISTS  "app"']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });
});
