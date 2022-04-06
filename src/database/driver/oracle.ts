import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { DatabaseCreateOperationContext, DatabaseDeleteOperationContext } from '../type';
import { DriverOptions } from './type';

export function createSimpleOracleConnection(
    driver: OracleDriver,
    options: DriverOptions,
) {
    const { getConnection } = driver.oracle;

    if (!options.connectString) {
        let address = '(PROTOCOL=TCP)';

        if (options.host) {
            address += `(HOST=${options.host})`;
        }

        if (options.port) {
            address += `(PORT=${options.port})`;
        }

        let connectData = '(SERVER=DEDICATED)';

        if (options.sid) {
            connectData += `(SID=${options.sid})`;
        }

        if (options.serviceName) {
            connectData += `(SERVICE_NAME=${options.serviceName})`;
        }

        options.connectString = `(DESCRIPTION=(ADDRESS=${address})(CONNECT_DATA=${connectData}))`;
    }

    return getConnection({
        user: options.user,
        password: options.password,
        connectString: options.connectString || options.url,
        ...(options.extra ? options.extra : {}),
    });
}

export async function createOracleDatabase(
    driver: OracleDriver,
    options: DriverOptions,
    operationContext: DatabaseCreateOperationContext,
) {
    const connection = createSimpleOracleConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */
    const query = `CREATE DATABASE IF NOT EXISTS ${options.database}`;

    return connection.execute(query);
}

export async function dropOracleDatabase(
    driver: OracleDriver,
    options: DriverOptions,
    operationContext: DatabaseDeleteOperationContext,
) {
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */

    return Promise.resolve();
}
