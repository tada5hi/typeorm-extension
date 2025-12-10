import { DriverError } from '../../../errors';
import type {
    DatabaseDropContextInput,
} from '../type';
import {
    dropCockroachDBDatabase,
    dropMongoDBDatabase,
    dropMsSQLDatabase,
    dropMySQLDatabase,
    dropOracleDatabase,
    dropPostgresDatabase,
    dropSQLiteDatabase,
} from '../../driver';
import { buildDatabaseDropContext } from '../context';

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param input
 */
export async function dropDatabase(input: DatabaseDropContextInput = {}) : Promise<unknown> {
    const context = await buildDatabaseDropContext(input);

    let output : unknown | undefined;

    switch (context.options.type) {
        case 'mongodb':
            output = await dropMongoDBDatabase(context);
            break;
        case 'mysql':
        case 'mariadb':
            output = await dropMySQLDatabase(context);
            break;
        case 'postgres':
            output = await dropPostgresDatabase(context);
            break;
        case 'cockroachdb':
            output = await dropCockroachDBDatabase(context);
            break;
        case 'sqlite':
        case 'better-sqlite3':
            output = await dropSQLiteDatabase(context);
            break;
        case 'oracle':
            output = await dropOracleDatabase(context);
            break;
        case 'mssql':
            output = await dropMsSQLDatabase(context);
            break;
        default:
            throw DriverError.notSupported(context.options.type);
    }

    return output;
}
