import type { MongoDriver } from 'typeorm/driver/mongodb/MongoDriver';
import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { executeDatabaseCreate, executeDatabaseDrop } from '../methods/execute';
import type { DriverOptions } from './types';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../utils';

/**
 * @deprecated Use createDatabase() / the connection ports instead. Removed in the next major.
 */
export async function createSimpleMongoDBConnection(
    driver: MongoDriver,
    options: DriverOptions,
) {
    /**
     * mongodb library
     */
    const { MongoClient } = driver.mongodb;

    let url = 'mongodb://';
    if (options.user && options.password) {
        url += `${options.user}:${options.password}@`;
    }

    url += `${options.host || '127.0.0.1'}:${options.port || 27017}/${options.database}`;
    if (options.ssl) {
        url += '?tls=true';
    }

    const client = new MongoClient(url);
    await client.connect();
    return client;
}

/**
 * @deprecated Use createDatabase() instead — dialect dispatch is automatic.
 */
export async function createMongoDBDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('mongodb', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropMongoDBDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('mongodb', context);
}
