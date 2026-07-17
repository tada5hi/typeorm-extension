import type { DataSourceOptions } from 'typeorm';
import type { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { useNativeDriver } from './typeorm-driver';
import { promisifyCallbackQuery } from './utils';

/**
 * Serves postgres AND cockroachdb — both speak the pg wire protocol.
 */
export class PostgresConnector implements IDatabaseConnector {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    session(database?: string): IDatabaseSession {
        const { options, params } = this;

        const data: Record<string, any> = {
            host: params.host,
            port: params.port,
            user: params.user,
            password: params.password,
            ssl: params.ssl,
            schema: params.schema,
            ...(params.extra ? params.extra : {}),
            ...(typeof database === 'string' ? { database } : {}),
        };

        let client: any;
        let openPromise: Promise<void> | undefined;
        let closed = false;

        const open = () => {
            if (closed) {
                return Promise.reject(DriverError.sessionClosed());
            }

            if (!openPromise) {
                openPromise = (async () => {
                    // native client acquisition stays lazy: DriverFactory
                    // requires the client library on first use
                    const driver = useNativeDriver(options) as PostgresDriver | CockroachDriver;
                    const { Client } = driver.postgres;

                    client = new Client(data);
                    await client.connect();
                })();
            }

            return openPromise;
        };

        return {
            open,
            execute: async (sql: string) => {
                await open();

                return promisifyCallbackQuery(client, sql);
            },
            close: async () => {
                if (closed) {
                    return;
                }

                closed = true;

                if (openPromise) {
                    try {
                        await openPromise;
                    } catch {
                        // opening failed — nothing to close
                    }
                }

                if (!client) {
                    return;
                }

                const current = client;
                client = undefined;
                await current.end();
            },
        };
    }
}
