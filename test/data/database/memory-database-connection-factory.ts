import type {
    IDatabaseConnection,
    IDatabaseConnectionFactory,
} from '../../../src/database/core';

export type MemoryConnectorEvent =    | {
    type: 'open', 
    connection: number, 
    database?: string 
} |
    {
        type: 'execute', 
        connection: number, 
        statement: string     
    } |
    { type: 'close', connection: number };

/**
 * Recording in-memory implementation of the SQL connection factory.
 * The respond callback simulates server state (e.g. "database exists").
 */
export class MemoryDatabaseConnectionFactory implements IDatabaseConnectionFactory {
    events: MemoryConnectorEvent[] = [];

    openConnections = new Set<number>();

    protected counter = 0;

    protected respond: (statement: string, database?: string) => unknown;

    constructor(respond?: (statement: string, database?: string) => unknown) {
        this.respond = respond || (() => ({ ok: true }));
    }

    create(database?: string): IDatabaseConnection {
        this.counter += 1;
        const connection = this.counter;

        let opened = false;
        let closed = false;

        const open = async () => {
            if (closed) {
                throw new Error('The connection has already been closed.');
            }

            if (opened) {
                return;
            }

            opened = true;
            this.openConnections.add(connection);
            this.events.push({
                type: 'open', 
                connection, 
                database, 
            });
        };

        return {
            open,
            execute: async (statement: string) => {
                await open();

                this.events.push({
                    type: 'execute', 
                    connection, 
                    statement,
                });
                return this.respond(statement, database);
            },
            close: async () => {
                if (closed) {
                    return;
                }

                closed = true;

                if (!opened) {
                    return;
                }

                this.openConnections.delete(connection);
                this.events.push({ type: 'close', connection });
            },
        };
    }

    statements(): string[] {
        return this.events.flatMap(
            (event) => (event.type === 'execute' ? [event.statement] : []),
        );
    }

    eventTypes(): string[] {
        return this.events.map((event) => event.type);
    }
}
