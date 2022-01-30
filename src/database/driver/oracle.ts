import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';

export function createSimpleOracleConnection(
    driver: OracleDriver,
    connectionOptions: DriverConnectionOptions,
) {
    const { getConnection } = driver.oracle;

    return getConnection({
        user: connectionOptions.user,
        password: connectionOptions.password,
        connectString: connectionOptions.url,
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
