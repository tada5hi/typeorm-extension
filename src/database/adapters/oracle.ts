import type { DataSourceOptions } from 'typeorm';
import type { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import type {
    ConnectionParams,
    IDatabaseConnection,
    IDatabaseServerPort,
} from '../core';
import { buildOracleConnectString } from '../core';
import { useNativeDriver } from './typeorm-driver';

export class OracleServerPort implements IDatabaseServerPort {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    async connect(): Promise<IDatabaseConnection> {
        const driver = useNativeDriver(this.options) as OracleDriver;
        const { getConnection } = driver.oracle;

        const connectString = this.params.connectString ||
            buildOracleConnectString(this.params);

        const connection = await getConnection({
            user: this.params.user,
            password: this.params.password,
            connectString: connectString || this.params.url,
            ...(this.params.extra ? this.params.extra : {}),
        });

        return {
            execute: (sql: string) => connection.execute(sql),
            close: async () => {
                await connection.close();
            },
        };
    }
}
