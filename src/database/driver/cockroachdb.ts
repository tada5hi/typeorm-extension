import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { createSimplePostgresConnection } from './postgres';
import { buildDriverOptions, createDriver } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, synchronizeDatabase } from '../utils';

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
    context = await buildDatabaseCreateContext(context);

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
    const result = executeSimpleCockroachDBQuery(connection, query);

    if (context.synchronize) {
        await synchronizeDatabase(context.options);
    }

    return result;
}

export async function dropCockroachDBDatabase(
    context?: DatabaseDropContext,
) {
    context = await buildDatabaseDropContext(context);

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
