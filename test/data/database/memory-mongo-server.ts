import type {
    IMongoDatabaseConnection,
    IMongoDatabaseServerPort,
} from '../../../src/database/core';

export type MemoryMongoEvent =    | {
    type: 'connect', 
    session: number, 
    database?: string 
} |
    { type: 'dropDatabase', session: number } |
    { type: 'close', session: number };

export class MemoryMongoDatabaseServer implements IMongoDatabaseServerPort {
    events: MemoryMongoEvent[] = [];

    openSessions = new Set<number>();

    protected counter = 0;

    async connect(database?: string): Promise<IMongoDatabaseConnection> {
        this.counter += 1;
        const session = this.counter;

        this.openSessions.add(session);
        this.events.push({
            type: 'connect', 
            session, 
            database, 
        });

        return {
            dropDatabase: async () => {
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
