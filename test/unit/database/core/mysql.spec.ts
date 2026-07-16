import {
    MySQLDialect,
    buildMySQLCreateDatabaseQuery,
    deriveMySQLCharacterSet,
} from '../../../../src/database/core';
import { MemoryDatabaseServer, createMemoryRuntime } from '../../../data/database';

describe('src/database/core/mysql', () => {
    it('should create database', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MySQLDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual(['CREATE DATABASE IF NOT EXISTS `app`']);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should create database with derived character set', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MySQLDialect();

        await dialect.create({
            params: { database: 'app', charset: 'utf8mb4_general_ci' },
            ifNotExist: false,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
        ]);
    });

    it('should wrap drop in foreign key check toggles on one session', async () => {
        const server = new MemoryDatabaseServer();
        const dialect = new MySQLDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ server }));

        expect(server.sql()).toEqual([
            'SET FOREIGN_KEY_CHECKS=0;',
            'DROP DATABASE IF EXISTS `app`',
            'SET FOREIGN_KEY_CHECKS=1;',
        ]);
        expect(server.events.filter((event) => event.type === 'connect')).toHaveLength(1);
        expect(server.events.at(-1)?.type).toEqual('close');
        expect(server.openSessions.size).toEqual(0);
    });

    it('should restore foreign key checks and close when drop fails', async () => {
        const server = new MemoryDatabaseServer((sql) => {
            if (sql.startsWith('DROP DATABASE')) {
                throw new Error('boom');
            }

            return { ok: true };
        });
        const dialect = new MySQLDialect();

        await expect(dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ server }))).rejects.toThrow('boom');

        expect(server.sql()).toEqual([
            'SET FOREIGN_KEY_CHECKS=0;',
            'DROP DATABASE IF EXISTS `app`',
            'SET FOREIGN_KEY_CHECKS=1;',
        ]);
        expect(server.openSessions.size).toEqual(0);
    });

    it('should derive the character set from the collation', () => {
        expect(deriveMySQLCharacterSet('utf8mb4_general_ci')).toEqual('utf8mb4');
        expect(deriveMySQLCharacterSet('UTF8_general_ci')).toEqual('utf8');
        expect(deriveMySQLCharacterSet('latin1_swedish_ci')).toBeUndefined();
        expect(deriveMySQLCharacterSet('latin1_swedish_ci', 'latin1')).toEqual('latin1');
    });

    it('should not append charset clause without derivable character set', () => {
        expect(buildMySQLCreateDatabaseQuery({
            database: 'app',
            charset: 'latin1_swedish_ci',
        }, false)).toEqual('CREATE DATABASE `app`');
    });
});
