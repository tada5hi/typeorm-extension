import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';

export function createSimpleOracleConnection(
    driver: OracleDriver,
    connectionOptions: DriverConnectionOptions,
) {
    const { getConnection } = driver.oracle;

    if (!connectionOptions.connectString) {
        let address = '(PROTOCOL=TCP)';

        if (connectionOptions.host) {
            address += `(HOST=${connectionOptions.host})`;
        }

        if (connectionOptions.port) {
            address += `(PORT=${connectionOptions.port})`;
        }

        let connectData = '(SERVER=DEDICATED)';

        if (connectionOptions.sid) {
            connectData += `(SID=${connectionOptions.sid})`;
        }

        if (connectionOptions.serviceName) {
            connectData += `(SERVICE_NAME=${connectionOptions.serviceName})`;
        }

        connectionOptions.connectString = `(DESCRIPTION=(ADDRESS=${address})(CONNECT_DATA=${connectData}))`;
    }

    return getConnection({
        user: connectionOptions.user,
        password: connectionOptions.password,
        connectString: connectionOptions.connectString || connectionOptions.url,
        ...(connectionOptions.extra ? connectionOptions.extra : {}),
    });
}

export async function createOracleDatabase(
    driver: OracleDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = createSimpleOracleConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */
    const query = `CREATE DATABASE IF NOT EXISTS ${connectionOptions.database}`;

    return connection.execute(query);
}

export async function dropOracleDatabase(
    driver: OracleDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */

    return Promise.resolve();
}
