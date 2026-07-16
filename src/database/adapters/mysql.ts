import type { DataSourceOptions } from 'typeorm';
import type { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import type {
    ConnectionParams,
    IDatabaseConnection,
    IDatabaseConnector,
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

    async connect(database?: string): Promise<IDatabaseConnection> {
        const driver = useNativeDriver(this.options) as MysqlDriver;
        const { createConnection } = driver.mysql;

        const option: Record<string, any> = {
            host: this.params.host,
            user: this.params.user,
            password: this.params.password,
            port: this.params.port,
            ssl: this.params.ssl,
            ...(this.params.extra ? this.params.extra : {}),
            ...(typeof database === 'string' ? { database } : {}),
        };

        const connection = await createConnection(option);

        return {
            execute: (sql: string) => promisifyCallbackQuery(connection, sql),
            close: () => new Promise<void>((resolve) => {
                connection.end(() => resolve());
            }),
        };
    }
}
