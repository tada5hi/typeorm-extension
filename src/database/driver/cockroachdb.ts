import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { createSimplePostgresConnection } from './postgres';
import { buildDataSourceOptions } from '../../connection';
import { buildDriverOptions, createDriver } from './utils';

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
    context?: DatabaseCreateContext,
) {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as CockroachDriver;

    const connection = await createSimplePostgresConnection(
        driver,
        options,
        context,
    );

    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L347
     */
    const query = `CREATE DATABASE ${context.ifNotExist ? 'IF NOT EXISTS ' : ''} "${options.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}

export async function dropCockroachDBDatabase(
    context?: DatabaseDropContext,
) {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as CockroachDriver;

    const connection = await createSimplePostgresConnection(
        driver,
        options,
        context,
    );
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L356
     */
    const query = `DROP DATABASE ${context.ifExist ? 'IF EXISTS ' : ''} "${options.database}"`;

    return executeSimpleCockroachDBQuery(connection, query);
}
