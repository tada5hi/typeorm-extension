import { Connection, ConnectionOptions } from 'typeorm';

import { DriverFactory } from 'typeorm/driver/DriverFactory';
import { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';

import { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import { createMySQLDatabase, dropMySQLDatabase } from './driver/mysql';
import { createPostgresDatabase, dropPostgresDatabase } from './driver/postgres';
import { createOracleDatabase, dropOracleDatabase } from './driver/oracle';
import { createMsSQLDatabase, dropMsSQLDatabase } from './driver/mssql';
import { SimpleConnectionOptions, buildConnectionOptions } from '../connection';
import { buildSimpleConnectionOptions } from '../connection/utils';
import { createSQLiteDatabase, dropSQLiteDatabase } from './driver/sqlite';
import { NotSupportedDriver } from './error';
import { ConnectionWithAdditionalOptions, DatabaseOperationOptions } from './type';
import { createCockroachDBDatabase, dropCockroachDBDatabase } from './driver/cockroachdb';

export * from './query';
export * from './error';
export * from './type';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param connectionOptions
 * @param options
 */
export async function createDatabase(options?: DatabaseOperationOptions, connectionOptions?: ConnectionOptions) {
    return createOrDropDatabase('create', options, connectionOptions);
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
    return createOrDropDatabase('drop', options, connectionOptions);
}

async function createOrDropDatabase(
    action: 'create' | 'drop',
    options?: DatabaseOperationOptions,
    connectionOptions?: ConnectionOptions,
) {
    if (typeof connectionOptions === 'undefined') {
        connectionOptions = await buildConnectionOptions();
    }

    const fakeConnection : Connection = {
        options: {
            type: connectionOptions.type,
        },
    } as Connection;

    const driverFactory = new DriverFactory();
    const driver = driverFactory.create(fakeConnection);

    const isCreateOperation : boolean = action === 'create';

    const simpleConnectionOptions : SimpleConnectionOptions = buildSimpleConnectionOptions(connectionOptions);

    options = options ?? {};
    const customOptions : DatabaseOperationOptions = extendCustomOptions(options, connectionOptions);

    if (driver instanceof SqliteDriver) {
        if (isCreateOperation) {
            return createSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof MysqlDriver) {
        if (isCreateOperation) {
            return createMySQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropMySQLDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof PostgresDriver) {
        if (isCreateOperation) {
            return createPostgresDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropPostgresDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof CockroachDriver) {
        if (isCreateOperation) {
            return createCockroachDBDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropCockroachDBDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof OracleDriver) {
        if (isCreateOperation) {
            return createOracleDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropOracleDatabase(driver, simpleConnectionOptions, customOptions);
    }

    if (driver instanceof SqlServerDriver) {
        if (isCreateOperation) {
            return createMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
        return dropMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
    }

    throw new NotSupportedDriver(connectionOptions.type);
}

export function extendCustomOptions(
    options: DatabaseOperationOptions,
    connectionOptions: ConnectionWithAdditionalOptions,
) {
    if (typeof connectionOptions?.charset === 'string') {
        options.charset = (connectionOptions as ConnectionWithAdditionalOptions).charset;
    }

    if (typeof connectionOptions?.characterSet === 'string') {
        options.characterSet = (connectionOptions as ConnectionWithAdditionalOptions).characterSet;
    }

    if (typeof connectionOptions?.extra?.charset === 'string') {
        options.charset = connectionOptions.extra.charset;
    }

    if (typeof connectionOptions?.extra?.characterSet === 'string') {
        options.characterSet = connectionOptions.extra.characterSet;
    }

    return options;
}
