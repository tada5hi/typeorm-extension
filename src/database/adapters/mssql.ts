import type { DataSourceOptions } from 'typeorm';
import type { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import type {
    ConnectionParams,
    IDatabaseConnection,
    IDatabaseServerPort,
} from '../core';
import { useNativeDriver } from './typeorm-driver';

export class MsSQLServerPort implements IDatabaseServerPort {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    async connect(database?: string): Promise<IDatabaseConnection> {
        const driver = useNativeDriver(this.options) as SqlServerDriver;

        const option: Record<string, any> = {
            user: this.params.user,
            password: this.params.password,
            server: this.params.host,
            port: this.params.port || 1433,
            ...(this.params.extra ? this.params.extra : {}),
            ...(this.params.domain ? { domain: this.params.domain } : {}),
            ...(typeof database === 'string' ? { database } : {}),
        };

        const pool = await driver.mssql.connect(option);

        return {
            execute: (sql: string) => pool.request().query(sql),
            close: async () => {
                await pool.close();
            },
        };
    }
}
