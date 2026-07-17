import type { DataSourceOptions } from 'typeorm';
import type { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { useNativeDriver } from './typeorm-driver';

export class MsSQLConnector implements IDatabaseConnector {
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
            user: params.user,
            password: params.password,
            server: params.host,
            port: params.port || 1433,
            ...(params.extra ? params.extra : {}),
            ...(params.domain ? { domain: params.domain } : {}),
            ...(typeof database === 'string' ? { database } : {}),
        };

        let pool: any;
        let openPromise: Promise<void> | undefined;
        let closed = false;

        const open = () => {
            if (closed) {
                return Promise.reject(DriverError.sessionClosed());
            }

            if (!openPromise) {
                openPromise = (async () => {
                    const driver = useNativeDriver(options) as SqlServerDriver;

                    // dedicated pool — the module level connect() would share
                    // one global pool across sessions
                    pool = await new driver.mssql.ConnectionPool(option).connect();
                })();
            }

            return openPromise;
        };

        return {
            open,
            execute: async (sql: string) => {
                await open();

                return pool.request().query(sql);
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

                if (!pool) {
                    return;
                }

                const current = pool;
                pool = undefined;
                await current.close();
            },
        };
    }
}
