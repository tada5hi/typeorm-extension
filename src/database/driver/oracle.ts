import {OracleDriver} from "typeorm/driver/oracle/OracleDriver";
import {SimpleConnectionOptions} from "../../connection";
import {DatabaseOperationOptions} from "../type";

export function createSimpleOracleConnection(
    driver: OracleDriver,
    connectionOptions: SimpleConnectionOptions
) {
    const {getConnection} = driver.oracle;

    return getConnection({
        user: connectionOptions.user,
        password: connectionOptions.password,
        connectString: connectionOptions.url
    });
}

export async function createOracleDatabase(
    driver: OracleDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: DatabaseOperationOptions
) {
    const connection = createSimpleOracleConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */
    const query : string = `CREATE DATABASE IF NOT EXISTS ${connectionOptions.database}`;

    return await connection.execute(query);
}

export async function dropOracleDatabase(
    driver: OracleDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: DatabaseOperationOptions
) {
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */

    return await Promise.resolve();
}
