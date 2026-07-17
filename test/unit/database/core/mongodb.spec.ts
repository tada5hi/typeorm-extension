import {
    MongoDBDialect,
    buildMongoDBConnectionUri,
    buildMongoDBDropDatabaseCommand,
} from '../../../../src/database/core';
import { MemoryDatabaseConnector } from '../../../data/database';

describe('src/database/core/mongodb', () => {
    it('should create database by opening and closing a session', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new MongoDBDialect(connector);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(connector.eventTypes()).toEqual(['open', 'close']);
        expect(connector.events[0]).toEqual({
            type: 'open',
            session: 1,
            database: 'app',
        });
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should drop database with a command document', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new MongoDBDialect(connector);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(connector.eventTypes()).toEqual(['open', 'execute', 'close']);
        expect(connector.statements()).toEqual(['{"dropDatabase":1}']);
        expect(connector.openSessions.size).toEqual(0);
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
