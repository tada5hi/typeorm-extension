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
        let pool: any;

        return {
            open: async () => {
                if (pool) {
                    return;
                }

                const driver = useNativeDriver(options) as SqlServerDriver;

                const option: Record<string, any> = {
                    user: params.user,
                    password: params.password,
                    server: params.host,
                    port: params.port || 1433,
                    ...(params.extra ? params.extra : {}),
                    ...(params.domain ? { domain: params.domain } : {}),
                    ...(typeof database === 'string' ? { database } : {}),
                };

                pool = await driver.mssql.connect(option);
            },
            execute: (sql: string) => {
                if (!pool) {
                    return Promise.reject(DriverError.sessionNotOpen());
                }

                return pool.request().query(sql);
            },
            close: async () => {
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
