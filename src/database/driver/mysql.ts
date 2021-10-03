import {MysqlDriver} from "typeorm/driver/mysql/MysqlDriver";

import {SimpleConnectionOptions} from "../../connection";
import {DatabaseOperationOptions} from "../type";

export async function createSimpleMySQLConnection(
    driver: MysqlDriver,
    connectionOptions: SimpleConnectionOptions
) {
    /**
     * mysql|mysql2 library
     */
    const {createConnection} = driver.mysql;

    let option : Record<string,any> | string;

    if(typeof connectionOptions.url === 'string') {
        option = connectionOptions.url;
    } else {
        option = {
            host: connectionOptions.host,
            user: connectionOptions.user,
            password: connectionOptions.password,
            port: Number(connectionOptions.port ?? 3306)
        };
    }

    return await createConnection(option);
}

export async function executeSimpleMysqlQuery(connection: any, query: string, endConnection: boolean = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if(endConnection) connection.end();

            if (queryErr) {
                reject(queryErr);
            }

            resolve(queryResult);
        });
    }));
}

export async function createMySQLDatabase(
    driver: MysqlDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: DatabaseOperationOptions
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L297
     */
    let query = customOptions.ifNotExist ? `CREATE DATABASE IF NOT EXISTS \`${connectionOptions.database}\`` : `CREATE DATABASE \`${connectionOptions.database}\``;
    if(typeof customOptions.charset === 'string') {
        const charset : string = customOptions.charset;
        let characterSet : string | undefined = customOptions.characterSet;

        if(typeof characterSet === 'undefined') {
            if(charset.toLowerCase().startsWith('utf8mb4')) {
                characterSet = 'utf8mb4';
            } else if(charset.toLowerCase().startsWith('utf8')) {
                characterSet = 'utf8';
            }
        }

        if(typeof characterSet === 'string') {
            query += ` CHARACTER SET ${characterSet} COLLATE ${charset}`;
        }
    }

    return await executeSimpleMysqlQuery(connection, query);
}

export async function dropMySQLDatabase(
    driver: MysqlDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: DatabaseOperationOptions
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L306
     */
    const query = customOptions.ifExist ? `DROP DATABASE IF EXISTS \`${connectionOptions.database}\`` : `DROP DATABASE \`${connectionOptions.database}\``;

    await executeSimpleMysqlQuery(connection, `SET FOREIGN_KEY_CHECKS=0;`, false);
    const result = await executeSimpleMysqlQuery(connection, query, false);
    await executeSimpleMysqlQuery(connection, `SET FOREIGN_KEY_CHECKS=1;`);
    return result;
}
