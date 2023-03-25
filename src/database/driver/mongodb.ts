import type { MongoDriver } from 'typeorm/driver/mongodb/MongoDriver';
import { OptionsError } from '../../errors';
import type { DatabaseCreateContext, DatabaseDropContext } from '../type';
import type { DriverOptions } from './type';
import { buildDriverOptions, createDriver } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, setupDatabaseSchema } from '../utils';

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

export async function createMongoDBDatabase(
    context?: DatabaseCreateContext,
) {
    context = await buildDatabaseCreateContext(context);
    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as MongoDriver;

    // connection setup, will create the database on the fly.
    const client = await createSimpleMongoDBConnection(driver, options);
    await client.close();

    if (context.synchronize) {
        await setupDatabaseSchema(context.options);
    }
}

export async function dropMongoDBDatabase(
    context?: DatabaseDropContext,
) {
    context = await buildDatabaseDropContext(context);
    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as MongoDriver;

    const client = await createSimpleMongoDBConnection(driver, options);
    const result = await client.dropDatabase();
    await client.close();

    return result;
}
