import { DriverError } from '../../../errors';
import type {
    DatabaseCreateContextInput,
} from '../type';
import {
    createCockroachDBDatabase,
    createMongoDBDatabase,
    createMsSQLDatabase,
    createMySQLDatabase,
    createOracleDatabase,
    createPostgresDatabase,
    createSQLiteDatabase,
} from '../../driver';
import { buildDatabaseCreateContext } from '../context';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param input
 */
export async function createDatabase(input: DatabaseCreateContextInput = {}) : Promise<unknown> {
    const context = await buildDatabaseCreateContext(input);

    let output : unknown | undefined;

    switch (context.options.type) {
        case 'mongodb':
            output = await createMongoDBDatabase(context);
            break;
        case 'mysql':
        case 'mariadb':
            output = await createMySQLDatabase(context);
            break;
        case 'postgres':
            output = await createPostgresDatabase(context);
            break;
        case 'cockroachdb':
            output = await createCockroachDBDatabase(context);
            break;
        case 'sqlite':
        case 'better-sqlite3':
            output = await createSQLiteDatabase(context);
            break;
        case 'oracle':
            output = await createOracleDatabase(context);
            break;
        case 'mssql':
            output = await createMsSQLDatabase(context);
            break;
        default:
            throw DriverError.notSupported(context.options.type);
    }

    return output;
}
