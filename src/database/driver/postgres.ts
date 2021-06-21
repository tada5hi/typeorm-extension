import {PostgresDriver} from "typeorm/driver/postgres/PostgresDriver";

import {SimpleConnectionOptions} from "../../connection";
import {CustomOptions} from "../type";

export async function createSimplePostgresConnection(
    driver: PostgresDriver,
    connectionOptions: SimpleConnectionOptions
) {
    /**
     * pg library
     */
    const {Client} = driver.postgres;
    let options : Record<string, any> = {};

    if(typeof connectionOptions.url === 'string') {
        options.connectionString = connectionOptions.url;
    } else {
        options = {
            host: connectionOptions.host,
            port: connectionOptions.port,
            user: connectionOptions.user,
            password: connectionOptions.password,
            ssl: connectionOptions.ssl
        };
    }

    const client = new Client(options);

    await client.connect();

    return client;
}

export async function executeSimplePostgresQuery(connection: any, query: string, endConnection: boolean = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if(endConnection) {
                connection.end();
            }

            if (queryErr) {
                reject(queryErr);
            }

            resolve(queryResult);
        });
    }));
}

export async function createPostgresDatabase(
    driver: PostgresDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const connection = await createSimplePostgresConnection(driver, connectionOptions);

    if(customOptions.ifNotExist) {
        const hasDatabaseQuery: string = `SELECT * FROM pg_database WHERE datname='${connectionOptions.database}';`;
        const hasDatabaseResult = await executeSimplePostgresQuery(connection, hasDatabaseQuery, false);
        const hasDatabase = !!(hasDatabaseResult as []).length;
        if(hasDatabase) {
            return;
        }
    }

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L326
     */
    let query = `CREATE DATABASE "${connectionOptions.database}"`;
    if(typeof customOptions.characterSet === 'string') {
        query += ` WITH ENCODING '${customOptions.characterSet}'`;
    }

    return await executeSimplePostgresQuery(connection, query);
}

export async function dropPostgresDatabase(
    driver: PostgresDriver,
    connectionOptions: SimpleConnectionOptions,
    customOptions: CustomOptions
) {
    const connection = await createSimplePostgresConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L343
     */
    const query = customOptions.ifExist ? `DROP DATABASE IF EXISTS "${connectionOptions.database}"` : `DROP DATABASE "${connectionOptions.database}"`;

    return await executeSimplePostgresQuery(connection, query);
}
