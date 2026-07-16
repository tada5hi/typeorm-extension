import type {
    IDatabaseConnection,
    IDatabaseServerPort,
} from '../../../src/database/core';

export type MemoryServerEvent =
    | { type: 'connect', session: number, database?: string }
    | { type: 'execute', session: number, sql: string }
    | { type: 'close', session: number };

/**
 * Recording in-memory implementation of the SQL server port.
 * The respond callback simulates server state (e.g. "database exists").
 */
export class MemoryDatabaseServer implements IDatabaseServerPort {
    events: MemoryServerEvent[] = [];

    openSessions = new Set<number>();

    protected counter = 0;

    protected respond: (sql: string, database?: string) => unknown;

    constructor(respond?: (sql: string, database?: string) => unknown) {
        this.respond = respond || (() => ({ ok: true }));
    }

    async connect(database?: string): Promise<IDatabaseConnection> {
        this.counter += 1;
        const session = this.counter;

        this.openSessions.add(session);
        this.events.push({ type: 'connect', session, database });

        return {
            execute: async (sql: string) => {
                this.events.push({ type: 'execute', session, sql });
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
