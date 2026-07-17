import {
    MongoDBDialect,
    buildMongoDBConnectionUri,
    buildMongoDBDropDatabaseCommand,
} from '../../../../src/database/core';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core/mongodb', () => {
    it('should create database by opening and closing a connection', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MongoDBDialect(connectionFactory);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connectionFactory.eventTypes()).toEqual(['open', 'close']);
        expect(connectionFactory.events[0]).toEqual({
            type: 'open',
            connection: 1,
            database: 'app',
        });
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should drop database with a command document', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const dialect = new MongoDBDialect(connectionFactory);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connectionFactory.eventTypes()).toEqual(['open', 'execute', 'close']);
        expect(connectionFactory.statements()).toEqual(['{"dropDatabase":1}']);
        expect(connectionFactory.openConnections.size).toEqual(0);
    });

    it('should build the drop database command', () => {
        expect(buildMongoDBDropDatabaseCommand()).toEqual('{"dropDatabase":1}');
    });

    it('should build the connection uri', () => {
        expect(buildMongoDBConnectionUri({ database: 'app' }))
            .toEqual('mongodb://127.0.0.1:27017/app');

        expect(buildMongoDBConnectionUri({
            database: 'app',
            host: 'db.example.com',
            port: 27018,
            user: 'admin',
            password: 'secret',
            ssl: true,
        })).toEqual('mongodb://admin:secret@db.example.com:27018/app?tls=true');

        expect(buildMongoDBConnectionUri({ database: 'app' }, 'other'))
            .toEqual('mongodb://127.0.0.1:27017/other');
    });

    it('should url encode credentials in the connection uri', () => {
        expect(buildMongoDBConnectionUri({
            database: 'app',
            user: 'ad@min',
            password: 'p@ss:w/rd',
        })).toEqual('mongodb://ad%40min:p%40ss%3Aw%2Frd@127.0.0.1:27017/app');
    });
});
