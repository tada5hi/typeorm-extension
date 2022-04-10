import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { DriverOptions } from './type';
import { buildDataSourceOptions } from '../../connection';
import { buildDriverOptions, createDriver } from './utils';

export async function createSimpleMySQLConnection(
    driver: MysqlDriver,
    options: DriverOptions,
) {
    /**
     * mysql|mysql2 library
     */
    const { createConnection } = driver.mysql;

    const option : Record<string, any> = {
        host: options.host,
        user: options.user,
        password: options.password,
        port: options.port,
        ssl: options.ssl,
        ...(options.extra ? options.extra : {}),
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
    context?: DatabaseCreateContext,
) {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as MysqlDriver;

    const connection = await createSimpleMySQLConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L297
     */
    let query = context.ifNotExist ?
        `CREATE DATABASE IF NOT EXISTS \`${options.database}\`` :
        `CREATE DATABASE \`${options.database}\``;

    if (typeof options.charset === 'string') {
        const { charset } = options;
        let { characterSet } = options;

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
    context?: DatabaseDropContext,
) {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as MysqlDriver;

    const connection = await createSimpleMySQLConnection(driver, options);

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L306
     */
    const query = context.ifExist ?
        `DROP DATABASE IF EXISTS \`${options.database}\`` :
        `DROP DATABASE \`${options.database}\``;

    await executeSimpleMysqlQuery(connection, 'SET FOREIGN_KEY_CHECKS=0;', false);
    const result = await executeSimpleMysqlQuery(connection, query, false);
    await executeSimpleMysqlQuery(connection, 'SET FOREIGN_KEY_CHECKS=1;');
    return result;
}
