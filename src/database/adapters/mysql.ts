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

        const option: Record<string, any> = {
            host: params.host,
            user: params.user,
            password: params.password,
            port: params.port,
            ssl: params.ssl,
            ...(params.extra ? params.extra : {}),
            ...(typeof database === 'string' ? { database } : {}),
        };

        let connection: any;
        let openPromise: Promise<void> | undefined;
        let closed = false;

        const open = () => {
            if (closed) {
                return Promise.reject(DriverError.sessionClosed());
            }

            if (!openPromise) {
                openPromise = (async () => {
                    const driver = useNativeDriver(options) as MysqlDriver;
                    const { createConnection } = driver.mysql;

                    connection = await createConnection(option);
                })();
            }

            return openPromise;
        };

        return {
            open,
            execute: async (sql: string) => {
                await open();

                return promisifyCallbackQuery(connection, sql);
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

                if (!connection) {
                    return;
                }

                const current = connection;
                connection = undefined;

                await new Promise<void>((resolve, reject) => {
                    current.end((error?: Error) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve();
                    });
                });
            },
        };
    }
}
