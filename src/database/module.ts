import { ConnectionOptions } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import { DatabaseOperationOptions } from './type';
import { DriverConnectionOptions, buildConnectionOptions } from '../connection';
import { extendDatabaseOperationOptions } from './utils';
import {
    buildDriverConnectionOptions,
    createCockroachDBDatabase, createDriver,
    createMsSQLDatabase,
    createMySQLDatabase,
    createOracleDatabase,
    createPostgresDatabase,
    createSQLiteDatabase,
    dropCockroachDBDatabase,
    dropMsSQLDatabase,
    dropMySQLDatabase,
    dropOracleDatabase,
    dropPostgresDatabase,
    dropSQLiteDatabase,
} from './driver';
import { NotSupportedDriver } from './error';
import { DatabaseOperation } from './constants';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param connectionOptions
 * @param options
 */
export async function createDatabase(options?: DatabaseOperationOptions, connectionOptions?: ConnectionOptions) {
    return createOrDropDatabase(DatabaseOperation.CREATE, options, connectionOptions);
}

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param connectionOptions
 * @param options
 */
export async function dropDatabase(options?: DatabaseOperationOptions, connectionOptions?: ConnectionOptions) {
    return createOrDropDatabase(DatabaseOperation.DELETE, options, connectionOptions);
}

// --------------------------------------------------------

async function createOrDropDatabase(
    operation: `${DatabaseOperation}`,
    options?: DatabaseOperationOptions,
    connectionOptions?: ConnectionOptions,
) {
    if (typeof connectionOptions === 'undefined') {
        connectionOptions = await buildConnectionOptions();
    }

    const driver = createDriver(connectionOptions);

    const simpleConnectionOptions: DriverConnectionOptions = buildDriverConnectionOptions(connectionOptions);

    options = options ?? {};
    const customOptions: DatabaseOperationOptions = extendDatabaseOperationOptions(options, connectionOptions);

    if (driver instanceof SqliteDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof MysqlDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createMySQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropMySQLDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof PostgresDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createPostgresDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropPostgresDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof CockroachDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createCockroachDBDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropCockroachDBDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof OracleDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createOracleDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropOracleDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof SqlServerDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
    }

    throw new NotSupportedDriver(connectionOptions.type);
}
