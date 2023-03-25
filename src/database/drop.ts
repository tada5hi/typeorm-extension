import { DriverError, OptionsError } from '../errors';
import type {
    DatabaseDropContext,
} from './type';
import {
    dropCockroachDBDatabase,
    dropMongoDBDatabase,
    dropMsSQLDatabase,
    dropMySQLDatabase,
    dropOracleDatabase,
    dropPostgresDatabase,
    dropSQLiteDatabase,
} from './driver';
import { buildDatabaseDropContext } from './utils';

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param context
 */
export async function dropDatabase(context?: DatabaseDropContext) {
    context = await buildDatabaseDropContext(context);

    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    if (!context.options.type) {
        throw DriverError.undeterminable();
    }

    switch (context.options.type) {
        case 'mongodb':
            return dropMongoDBDatabase(context);
        case 'mysql':
        case 'mariadb':
            return dropMySQLDatabase(context);
        case 'postgres':
            return dropPostgresDatabase(context);
        case 'cockroachdb':
            return dropCockroachDBDatabase(context);
        case 'sqlite':
        case 'better-sqlite3':
            return dropSQLiteDatabase(context);
        case 'oracle':
            return dropOracleDatabase(context);
        case 'mssql':
            return dropMsSQLDatabase(context);
    }

    throw DriverError.notSupported(context.options.type);
}
