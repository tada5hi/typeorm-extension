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

        let opened = false;
        let closed = false;

        const open = async () => {
            if (closed) {
                throw new Error('The session has already been closed.');
            }

            if (opened) {
                return;
            }

            opened = true;
            this.openSessions.add(session);
            this.events.push({
                type: 'open', 
                session, 
                database, 
            });
        };

        return {
            open,
            dropDatabase: async () => {
                await open();

                this.events.push({ type: 'dropDatabase', session });
                return true;
            },
            close: async () => {
                if (closed) {
                    return;
                }

                closed = true;

                if (!opened) {
                    return;
                }

                this.openSessions.delete(session);
                this.events.push({ type: 'close', session });
            },
        };
    }

    eventTypes(): string[] {
        return this.events.map((event) => event.type);
    }
}
