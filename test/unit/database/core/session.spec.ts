import { MemoryDatabaseConnector } from '../../../data/database';

describe('src/database/core (session contract)', () => {
    it('should open on demand when executing', async () => {
        const connector = new MemoryDatabaseConnector();
        const session = connector.session('app');

        await session.execute('SELECT 1');

        expect(connector.eventTypes()).toEqual(['open', 'execute']);
    });

    it('should share one open across repeated calls', async () => {
        const connector = new MemoryDatabaseConnector();
        const session = connector.session();

        await Promise.all([session.open(), session.open()]);
        await session.execute('SELECT 1');

        expect(connector.eventTypes()).toEqual(['open', 'execute']);
    });

    it('should be terminal after close', async () => {
        const connector = new MemoryDatabaseConnector();
        const session = connector.session();

        await session.open();
        await session.close();

        await expect(session.execute('SELECT 1')).rejects.toThrow('closed');
        await expect(session.open()).rejects.toThrow('closed');
    });

    it('should ignore closing a never opened session', async () => {
        const connector = new MemoryDatabaseConnector();
        const session = connector.session();

        await session.close();

        expect(connector.events).toEqual([]);
    });
});
