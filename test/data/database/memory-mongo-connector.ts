import type {
    IMongoDatabaseConnector,
    IMongoDatabaseSession,
} from '../../../src/database/core';

export type MemoryMongoConnectorEvent =    | {
    type: 'open', 
    session: number, 
    database?: string 
} |
    { type: 'dropDatabase', session: number } |
    { type: 'close', session: number };

export class MemoryMongoDatabaseConnector implements IMongoDatabaseConnector {
    events: MemoryMongoConnectorEvent[] = [];

    openSessions = new Set<number>();

    protected counter = 0;

    session(database?: string): IMongoDatabaseSession {
        this.counter += 1;
        const session = this.counter;

        return {
            open: async () => {
                this.openSessions.add(session);
                this.events.push({
                    type: 'open', 
                    session, 
                    database, 
                });
            },
            dropDatabase: async () => {
                if (!this.openSessions.has(session)) {
                    throw new Error('The session has not been opened yet.');
                }

                this.events.push({ type: 'dropDatabase', session });
                return true;
            },
            close: async () => {
                this.openSessions.delete(session);
                this.events.push({ type: 'close', session });
            },
        };
    }

    eventTypes(): string[] {
        return this.events.map((event) => event.type);
    }
}
