import {MysqlDriver} from "typeorm/driver/mysql/MysqlDriver";
import {SimpleConnectionOptions} from "../../connection";

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

export async function executeSimpleMysqlQuery(connection: any, query: string) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            connection.end();

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
    ifNotExist?: boolean
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L297
     */
    let query = ifNotExist ? `CREATE DATABASE IF NOT EXISTS \`${connectionOptions.database}\`` : `CREATE DATABASE \`${connectionOptions.database}\``;
    query += ` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

    return await executeSimpleMysqlQuery(connection, query);
}

export async function dropMySQLDatabase(
    driver: MysqlDriver,
    connectionOptions: SimpleConnectionOptions,
    ifExist?: boolean
) {
    const connection = await createSimpleMySQLConnection(driver, connectionOptions);

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L306
     */
    const query = ifExist ? `DROP DATABASE IF EXISTS \`${connectionOptions.database}\`` : `DROP DATABASE \`${connectionOptions.database}\``;

    return await executeSimpleMysqlQuery(connection, query);
}
