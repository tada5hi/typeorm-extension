import { DriverError, OptionsError } from '../errors';
import type {
    DatabaseCreateContext,
} from './type';
import {
    createCockroachDBDatabase,
    createMongoDBDatabase,
    createMsSQLDatabase,
    createMySQLDatabase,
    createOracleDatabase,
    createPostgresDatabase,
    createSQLiteDatabase,
} from './driver';
import { buildDatabaseCreateContext } from './utils';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param context
 */
export async function createDatabase(context?: DatabaseCreateContext) {
    context = await buildDatabaseCreateContext(context);

    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    if (!context.options.type) {
        throw DriverError.undeterminable();
    }

    switch (context.options.type) {
        case 'mongodb':
            return createMongoDBDatabase(context);
        case 'mysql':
        case 'mariadb':
            return createMySQLDatabase(context);
        case 'postgres':
            return createPostgresDatabase(context);
        case 'cockroachdb':
            return createCockroachDBDatabase(context);
        case 'sqlite':
        case 'better-sqlite3':
            return createSQLiteDatabase(context);
        case 'oracle':
            return createOracleDatabase(context);
        case 'mssql':
            return createMsSQLDatabase(context);
    }

    throw DriverError.notSupported(context.options.type);
}
