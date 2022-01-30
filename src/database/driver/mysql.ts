import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';

import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';

export async function createSimpleMySQLConnection(
    driver: MysqlDriver,
    connectionOptions: DriverConnectionOptions,
) {
    /**
     * mysql|mysql2 library
     */
    const { createConnection } = driver.mysql;

    const option : Record<string, any> = {
        host: connectionOptions.host,
        user: connectionOptions.user,
        password: connectionOptions.password,
        port: connectionOptions.port,
        ssl: connectionOptions.ssl,
        ...(connectionOptions.extra ? connectionOptions.extra : {}),
    };

    return createConnection(option);
}

export async function executeSimpleMysqlQuery(connection: any, query: string, endConnection = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if (endConnection) connection.end();

            if (queryErr) {
                reject(queryErr);
            }

            resolve(queryResult);
        });
    }));
}

export async function createMySQLDatabase(
    driver: MysqlDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L297
     */
    let query = customOptions.ifNotExist ? `CREATE DATABASE IF NOT EXISTS \`${connectionOptions.database}\`` : `CREATE DATABASE \`${connectionOptions.database}\``;
    if (typeof customOptions.charset === 'string') {
        const { charset } = customOptions;
        let { characterSet } = customOptions;

        if (typeof characterSet === 'undefined') {
            if (charset.toLowerCase().startsWith('utf8mb4')) {
                characterSet = 'utf8mb4';
            } else if (charset.toLowerCase().startsWith('utf8')) {
                characterSet = 'utf8';
            }
        }

        if (typeof characterSet === 'string') {
            query += ` CHARACTER SET ${characterSet} COLLATE ${charset}`;
        }
    }

    return executeSimpleMysqlQuery(connection, query);
}

export async function dropMySQLDatabase(
    driver: MysqlDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L306
     */
    const query = customOptions.ifExist ? `DROP DATABASE IF EXISTS \`${connectionOptions.database}\`` : `DROP DATABASE \`${connectionOptions.database}\``;

    await executeSimpleMysqlQuery(connection, 'SET FOREIGN_KEY_CHECKS=0;', false);
    const result = await executeSimpleMysqlQuery(connection, query, false);
    await executeSimpleMysqlQuery(connection, 'SET FOREIGN_KEY_CHECKS=1;');
    return result;
}
