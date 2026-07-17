import type { DataSourceOptions } from 'typeorm';
import type { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnection,
    IDatabaseConnectionFactory,
} from '../core';
import { buildOracleConnectString } from '../core';
import { useNativeDriver } from './typeorm-driver';

export class OracleConnectionFactory implements IDatabaseConnectionFactory {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    create(): IDatabaseConnection {
        const { options, params } = this;

        const connectString = params.connectString ||
            buildOracleConnectString(params);

        const option: Record<string, any> = {
            user: params.user,
            password: params.password,
            connectString: connectString || params.url,
            ...(params.extra ? params.extra : {}),
        };

        let connection: any;
        let openPromise: Promise<void> | undefined;
        let closed = false;

        const open = () => {
            if (closed) {
                return Promise.reject(DriverError.connectionClosed());
            }

            if (!openPromise) {
                openPromise = (async () => {
                    const driver = useNativeDriver(options) as OracleDriver;
                    const { getConnection } = driver.oracle;

                    connection = await getConnection(option);
                })();
            }

            return openPromise;
        };

        return {
            open,
            execute: async (sql: string) => {
                await open();

                return connection.execute(sql);
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
                await current.close();
            },
        };
    }
}
