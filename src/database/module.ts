import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';
import {
    DatabaseCreateOperationContext,
    DatabaseDeleteOperationContext,
    DatabaseOperationContext
} from './type';
import { buildDataSourceOptions } from '../connection';
import {
    buildDriverOptions,
    createCockroachDBDatabase,
    createDriver,
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
import { createBetterSQLite3Database, dropBetterSQLite3Database } from './driver/better-sqlite3';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param context
 */
export async function createDatabase(context?: DatabaseCreateOperationContext) {
    return createOrDropDatabase(DatabaseOperation.CREATE, context);
}

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param context
 */
export async function dropDatabase(context?: DatabaseDeleteOperationContext) {
    return createOrDropDatabase(DatabaseOperation.DELETE, context);
}

// --------------------------------------------------------

async function createOrDropDatabase<T extends `${DatabaseOperation}`>(
    operation: T,
    context?: DatabaseOperationContext<T>
) {
    context = context || {};

    if (typeof context.options === 'undefined') {
        context.options = await buildDataSourceOptions();
    }

    const driver = createDriver(context.options);
    const driverOptions = buildDriverOptions(context.options);

    if (driver instanceof SqliteDriver) {
        if (operation === `${DatabaseOperation.CREATE}`) {
            return createSQLiteDatabase(driver, driverOptions, context);
        }

        return dropSQLiteDatabase(driver, driverOptions, context);
    }

    if (driver instanceof BetterSqlite3Driver) {
        if (operation === DatabaseOperation.CREATE) {
            return createBetterSQLite3Database(driver, driverOptions, context);
        }

        return dropBetterSQLite3Database(driver, driverOptions, context);
    }

    if (driver instanceof MysqlDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createMySQLDatabase(driver, driverOptions, context);
        }

        return dropMySQLDatabase(driver, driverOptions, context);
    }

    if (driver instanceof PostgresDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createPostgresDatabase(driver, driverOptions, context);
        }

        return dropPostgresDatabase(driver, driverOptions, context);
    }

    if (driver instanceof CockroachDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createCockroachDBDatabase(driver, driverOptions, context);
        }

        return dropCockroachDBDatabase(driver, driverOptions, context);
    }

    if (driver instanceof OracleDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createOracleDatabase(driver, driverOptions, context);
        }

        return dropOracleDatabase(driver, driverOptions, context);
    }

    if (driver instanceof SqlServerDriver) {
        if (operation === DatabaseOperation.CREATE) {
            return createMsSQLDatabase(driver, driverOptions, context);
        }

        return dropMsSQLDatabase(driver, driverOptions, context);
    }

    throw new NotSupportedDriver(context.options.type);
}
