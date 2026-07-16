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
        let client: any;

        return {
            open: async () => {
                if (client) {
                    return;
                }

                const driver = useNativeDriver(options) as PostgresDriver | CockroachDriver;
                const { Client } = driver.postgres;

                const data: Record<string, any> = {
                    host: params.host,
                    port: params.port,
                    user: params.user,
                    password: params.password,
                    ssl: params.ssl,
                    schema: params.schema,
                    ...(params.extra ? params.extra : {}),
                };

                if (typeof database === 'string') {
                    data.database = database;
                }

                client = new Client(data);
                await client.connect();
            },
            execute: (sql: string) => {
                if (!client) {
                    return Promise.reject(DriverError.sessionNotOpen());
                }

                return promisifyCallbackQuery(client, sql);
            },
            close: async () => {
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
