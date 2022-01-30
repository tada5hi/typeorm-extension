import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';
import { hasOwnProperty } from '../../utils';

export async function createSimplePostgresConnection(
    driver: PostgresDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    /**
     * pg library
     */
    const { Client } = driver.postgres;
    let options : Record<string, any> = {};

    if (typeof connectionOptions.url === 'string') {
        options.connectionString = connectionOptions.url;
    } else {
        options = {
            host: connectionOptions.host,
            port: connectionOptions.port,
            user: connectionOptions.user,
            password: connectionOptions.password,
            ssl: connectionOptions.ssl,
        };

        if (typeof customOptions.initialDatabase === 'string') {
            options.database = customOptions.initialDatabase;
        }
    }

    const client = new Client(options);

    await client.connect();

    return client;
}

export async function executeSimplePostgresQuery(connection: any, query: string, endConnection = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if (endConnection) {
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
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimplePostgresConnection(driver, connectionOptions, customOptions);

    if (customOptions.ifNotExist) {
        const existQuery = `SELECT * FROM pg_database WHERE lower(datname) = lower('${connectionOptions.database}');`;
        const existResult = await executeSimplePostgresQuery(connection, existQuery, false);

        if (
            typeof existResult === 'object' &&
            hasOwnProperty(existResult, 'rows') &&
            Array.isArray(existResult.rows) &&
            existResult.rows.length > 0
        ) {
            return Promise.resolve();
        }
    }

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L326
     */
    let query = `CREATE DATABASE "${connectionOptions.database}"`;
    if (typeof customOptions.characterSet === 'string') {
        query += ` WITH ENCODING '${customOptions.characterSet}'`;
    }

    return executeSimplePostgresQuery(connection, query);
}

export async function dropPostgresDatabase(
    driver: PostgresDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimplePostgresConnection(driver, connectionOptions, customOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L343
     */
    const query = customOptions.ifExist ? `DROP DATABASE IF EXISTS "${connectionOptions.database}"` : `DROP DATABASE "${connectionOptions.database}"`;

    return executeSimplePostgresQuery(connection, query);
}
