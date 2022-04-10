import {
    DatabaseDropContext,
} from './type';
import { buildDataSourceOptions } from '../connection';
import {
    dropCockroachDBDatabase,
    dropMsSQLDatabase,
    dropMySQLDatabase,
    dropOracleDatabase,
    dropPostgresDatabase,
    dropSQLiteDatabase,
} from './driver';
import { NotSupportedDriver } from './error';

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param context
 */
export async function dropDatabase(context?: DatabaseDropContext) {
    context = context || {};

    if (!context.options) {
        context.options = await buildDataSourceOptions();
    }

    if (!context.options.type) {
        throw new NotSupportedDriver(context.options.type);
    }

    switch (context.options.type) {
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

    throw new NotSupportedDriver(context.options.type);
}
