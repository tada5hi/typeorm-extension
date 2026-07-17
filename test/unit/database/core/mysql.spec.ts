import {
    MySQLDialect,
    buildMySQLCreateDatabaseQuery,
    deriveMySQLCharacterSet,
} from '../../../../src/database/core';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core/mysql', () => {
    it('should create database', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MySQLDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.statements()).toEqual(['CREATE DATABASE IF NOT EXISTS `app`']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should create database with derived character set', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MySQLDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app', charset: 'utf8mb4_general_ci' },
            ifNotExist: false,
        });

        expect(connectionFactory.statements()).toEqual([
            'CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
        ]);
    });

    it('should wrap drop in foreign key check toggles on one connection', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MySQLDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connectionFactory.statements()).toEqual([
            'SET FOREIGN_KEY_CHECKS=0;',
            'DROP DATABASE IF EXISTS `app`',
            'SET FOREIGN_KEY_CHECKS=1;',
        ]);
        expect(connectionFactory.events.filter((event) => event.type === 'open')).toHaveLength(1);
        expect(connectionFactory.events.at(-1)?.type).toEqual('close');
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should restore foreign key checks and close when drop fails', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory((sql) => {
            if (sql.startsWith('DROP DATABASE')) {
                throw new Error('boom');
            }

            return { ok: true };
        });
        const dialect = new MySQLDialect(connectionFactory);

        await expect(dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        })).rejects.toThrow('boom');

        expect(connectionFactory.statements()).toEqual([
            'SET FOREIGN_KEY_CHECKS=0;',
            'DROP DATABASE IF EXISTS `app`',
            'SET FOREIGN_KEY_CHECKS=1;',
        ]);
        expect(connectionFactory.openConnections.size).toEqual(0);
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
