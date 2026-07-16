import {
    MongoDBDialect,
    buildMongoDBConnectionUri,
} from '../../../../src/database/core';
import { MemoryMongoDatabaseConnector } from '../../../data/database';

describe('src/database/core/mongodb', () => {
    it('should create database by connecting and closing', async () => {
        const mongo = new MemoryMongoDatabaseConnector();
        const dialect = new MongoDBDialect(mongo);

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        });

        expect(mongo.eventTypes()).toEqual(['open', 'close']);
        expect(mongo.events[0]).toEqual({
            type: 'open', 
            session: 1, 
            database: 'app', 
        });
        expect(mongo.openSessions.size).toEqual(0);
    });

    it('should drop database', async () => {
        const mongo = new MemoryMongoDatabaseConnector();
        const dialect = new MongoDBDialect(mongo);

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        });

        expect(mongo.eventTypes()).toEqual(['open', 'dropDatabase', 'close']);
        expect(mongo.openSessions.size).toEqual(0);
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
});
