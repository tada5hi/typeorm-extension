import {
    DatabaseCreateContext,
} from './type';
import { buildDataSourceOptions } from '../connection';
import {
    createCockroachDBDatabase,
    createMsSQLDatabase,
    createMySQLDatabase,
    createOracleDatabase,
    createPostgresDatabase,
    createSQLiteDatabase,
} from './driver';
import { NotSupportedDriver } from './error';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param context
 */
export async function createDatabase(context?: DatabaseCreateContext) {
    context = context || {};

    if (typeof context.options === 'undefined') {
        context.options = await buildDataSourceOptions();
    }

    if (!context.options.type) {
        throw new NotSupportedDriver(context.options.type);
    }

    switch (context.options.type) {
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

    throw new NotSupportedDriver(context.options.type);
}
