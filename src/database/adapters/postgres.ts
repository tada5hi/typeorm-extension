import type { DataSourceOptions } from 'typeorm';
import type { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import type {
    ConnectionParams,
    IDatabaseConnection,
    IDatabaseServerPort,
} from '../core';
import { useNativeDriver } from './typeorm-driver';
import { promisifyCallbackQuery } from './utils';

/**
 * Serves postgres AND cockroachdb — both speak the pg wire protocol.
 */
export class PostgresServerPort implements IDatabaseServerPort {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    async connect(database?: string): Promise<IDatabaseConnection> {
        const driver = useNativeDriver(this.options) as PostgresDriver | CockroachDriver;
        const { Client } = driver.postgres;

        const data: Record<string, any> = {
            host: this.params.host,
            port: this.params.port,
            user: this.params.user,
            password: this.params.password,
            ssl: this.params.ssl,
            schema: this.params.schema,
            ...(this.params.extra ? this.params.extra : {}),
        };

        if (typeof database === 'string') {
            data.database = database;
        }

        const client = new Client(data);
        await client.connect();

        return {
            execute: (sql: string) => promisifyCallbackQuery(client, sql),
            close: async () => {
                await client.end();
            },
        };
    }
}
