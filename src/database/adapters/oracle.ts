import type { DataSourceOptions } from 'typeorm';
import type { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { buildOracleConnectString } from '../core';
import { useNativeDriver } from './typeorm-driver';

export class OracleConnector implements IDatabaseConnector {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    session(): IDatabaseSession {
        const { options, params } = this;
        let connection: any;

        return {
            open: async () => {
                if (connection) {
                    return;
                }

                const driver = useNativeDriver(options) as OracleDriver;
                const { getConnection } = driver.oracle;

                const connectString = params.connectString ||
                    buildOracleConnectString(params);

                connection = await getConnection({
                    user: params.user,
                    password: params.password,
                    connectString: connectString || params.url,
                    ...(params.extra ? params.extra : {}),
                });
            },
            execute: (sql: string) => {
                if (!connection) {
                    return Promise.reject(DriverError.sessionNotOpen());
                }

                return connection.execute(sql);
            },
            close: async () => {
                if (!connection) {
                    return;
                }

                const current = connection;
                connection = undefined;
                await current.close();
            },
        };
    }
}
