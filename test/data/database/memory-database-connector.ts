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
            execute: async (sql: string) => {
                await open();

                this.events.push({
                    type: 'execute', 
                    session, 
                    sql, 
                });
                return this.respond(sql, database);
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

    sql(): string[] {
        return this.events.flatMap(
            (event) => (event.type === 'execute' ? [event.sql] : []),
        );
    }

    eventTypes(): string[] {
        return this.events.map((event) => event.type);
    }
}
