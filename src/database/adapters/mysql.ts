import type { DataSourceOptions } from 'typeorm';
import type { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { useNativeDriver } from './typeorm-driver';
import { promisifyCallbackQuery } from './utils';

/**
 * Serves mysql AND mariadb.
 */
export class MySQLConnector implements IDatabaseConnector {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    session(database?: string): IDatabaseSession {
        const { options, params } = this;
        let connection: any;

        return {
            open: async () => {
                if (connection) {
                    return;
                }

                const driver = useNativeDriver(options) as MysqlDriver;
                const { createConnection } = driver.mysql;

                const option: Record<string, any> = {
                    host: params.host,
                    user: params.user,
                    password: params.password,
                    port: params.port,
                    ssl: params.ssl,
                    ...(params.extra ? params.extra : {}),
                    ...(typeof database === 'string' ? { database } : {}),
                };

                connection = await createConnection(option);
            },
            execute: (sql: string) => {
                if (!connection) {
                    return Promise.reject(DriverError.sessionNotOpen());
                }

                return promisifyCallbackQuery(connection, sql);
            },
            close: () => new Promise<void>((resolve) => {
                if (!connection) {
                    resolve();
                    return;
                }

                const current = connection;
                connection = undefined;
                current.end(() => resolve());
            }),
        };
    }
}
