import { describe, expect, it } from 'vitest';
import { MsSQLDialect } from '../../../../src/database/core';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core/mssql', () => {
    it('should create database with DB_ID guard', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MsSQLDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.statements()).toEqual([
            'IF DB_ID(\'app\') IS NULL CREATE DATABASE "app"',
        ]);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should not append a character set clause', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MsSQLDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app', characterSet: 'UTF8' },
            ifNotExist: false,
        });

        expect(connectionFactory.statements()).toEqual([
            'CREATE DATABASE "app"',
        ]);
    });

    it('should drop database with DB_ID guard', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MsSQLDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connectionFactory.statements()).toEqual([
            'IF DB_ID(\'app\') IS NOT NULL DROP DATABASE "app"',
        ]);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });
});
