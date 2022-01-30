import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';
import { createSimplePostgresConnection } from './postgres';

export async function executeSimpleCockroachDBQuery(connection: any, query: string, endConnection = true) {
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

export async function createCockroachDBDatabase(
    driver: CockroachDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimplePostgresConnection(
        driver,
        connectionOptions,
        customOptions,
    );

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L347
     */
    const query = `CREATE DATABASE ${customOptions.ifNotExist ? 'IF NOT EXISTS ' : ''} "${connectionOptions.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}

export async function dropCockroachDBDatabase(
    driver: CockroachDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimplePostgresConnection(
        driver,
        connectionOptions,
        customOptions,
    );
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L356
     */
    const query = `DROP DATABASE ${customOptions.ifExist ? 'IF EXISTS ' : ''} "${connectionOptions.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}
