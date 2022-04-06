import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { DriverConnectionOptions } from '../../connection';
import { DatabaseCreateOperationContext, DatabaseDeleteOperationContext } from '../type';
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
    options: DriverConnectionOptions,
    operationContext: DatabaseCreateOperationContext,
) {
    const connection = await createSimplePostgresConnection(
        driver,
        options,
        operationContext,
    );

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L347
     */
    const query = `CREATE DATABASE ${operationContext.ifNotExist ? 'IF NOT EXISTS ' : ''} "${options.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}

export async function dropCockroachDBDatabase(
    driver: CockroachDriver,
    connectionOptions: DriverConnectionOptions,
    operationContext: DatabaseDeleteOperationContext,
) {
    const connection = await createSimplePostgresConnection(
        driver,
        connectionOptions,
        operationContext,
    );
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L356
     */
    const query = `DROP DATABASE ${operationContext.ifExist ? 'IF EXISTS ' : ''} "${connectionOptions.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}
