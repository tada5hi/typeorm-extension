import type {
    IDatabaseConnector,
    IDatabaseSession,
} from '../../../src/database/core';

export type MemoryConnectorEvent =    | {
    type: 'open', 
    session: number, 
    database?: string 
} |
    {
        type: 'execute', 
        session: number, 
        sql: string 
    } |
    { type: 'close', session: number };

/**
 * Recording in-memory implementation of the SQL connector.
 * The respond callback simulates server state (e.g. "database exists").
 */
export class MemoryDatabaseConnector implements IDatabaseConnector {
    events: MemoryConnectorEvent[] = [];

    openSessions = new Set<number>();

    protected counter = 0;

    protected respond: (sql: string, database?: string) => unknown;

    constructor(respond?: (sql: string, database?: string) => unknown) {
        this.respond = respond || (() => ({ ok: true }));
    }

    session(database?: string): IDatabaseSession {
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
            execute: async (sql: string) => {
                if (!this.openSessions.has(session)) {
                    throw new Error('The session has not been opened yet.');
                }

                this.events.push({
                    type: 'execute', 
                    session, 
                    sql, 
                });
                return this.respond(sql, database);
            },
            close: async () => {
                this.openSessions.delete(session);
                this.events.push({ type: 'close', session });
            },
        };
    }

    sql(): string[] {
        return this.events.flatMap(
            (event) => (event.type === 'execute' ? [event.sql] : []),
        );
    }

    eventTypes(): string[] {
        return this.events.map((event) => event.type);
    }
}
