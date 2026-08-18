import { describe, expect, it } from 'vitest';
import { MemoryDatabaseConnectionFactory } from '../../../data/database';

describe('src/database/core (connection contract)', () => {
    it('should open on demand when executing', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const connection = connectionFactory.create('app');

        await connection.execute('SELECT 1');

        expect(connectionFactory.eventTypes()).toEqual(['open', 'execute']);
    });

    it('should share one open across repeated calls', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const connection = connectionFactory.create();

        await Promise.all([connection.open(), connection.open()]);
        await connection.execute('SELECT 1');

        expect(connectionFactory.eventTypes()).toEqual(['open', 'execute']);
    });

    it('should be terminal after close', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const connection = connectionFactory.create();

        await connection.open();
        await connection.close();

        await expect(connection.execute('SELECT 1')).rejects.toThrow('closed');
        await expect(connection.open()).rejects.toThrow('closed');
    });

    it('should ignore closing a never opened connection', async () => {
        const connectionFactory = new MemoryDatabaseConnectionFactory();
        const connection = connectionFactory.create();

        await connection.close();

        expect(connectionFactory.events).toEqual([]);
    });
});
