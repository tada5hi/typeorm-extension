import {Connection, ConnectionOptions} from "typeorm";

import {DriverFactory} from "typeorm/driver/DriverFactory";
import {MysqlDriver} from "typeorm/driver/mysql/MysqlDriver";
import {SqliteDriver} from "typeorm/driver/sqlite/SqliteDriver";
import {PostgresDriver} from "typeorm/driver/postgres/PostgresDriver";
import {OracleDriver} from "typeorm/driver/oracle/OracleDriver";
import {SqlServerDriver} from "typeorm/driver/sqlserver/SqlServerDriver";

import {createMySQLDatabase, dropMySQLDatabase} from "./driver/mysql";
import {createPostgresDatabase, dropPostgresDatabase} from "./driver/postgres";
import {createOracleDatabase, dropOracleDatabase} from "./driver/oracle";
import {createMsSQLDatabase, dropMsSQLDatabase} from "./driver/mssql";
import {SimpleConnectionOptions} from "../connection";
import {buildSimpleConnectionOptions} from "../connection/utils";
import {createSQLiteDatabase, dropSQLiteDatabase} from "./driver/sqlite";
import {NotSupportedDriver} from "./error";
import {AdditionalConnectionOptions, ConnectionWithAdditionalOptions, CustomOptions} from "./type";

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
export async function createDatabase(connectionOptions: ConnectionOptions, options?: AdditionalConnectionOptions) {
    return await createOrDropDatabase(connectionOptions, 'create', options);
}

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws NotSupportedDriver
 *
 * @param connectionOptions
 * @param options
 */
export async function dropDatabase(connectionOptions: ConnectionOptions, options?: AdditionalConnectionOptions) {
    return await createOrDropDatabase(connectionOptions, 'drop', options);
}

async function createOrDropDatabase(
    connectionOptions: ConnectionOptions,
    action: 'create' | 'drop',
    options?: CustomOptions,
) {
    const fakeConnection : Connection = {
        options: {
            type: connectionOptions.type
        }
    } as Connection;

    const driverFactory = new DriverFactory();
    const driver = driverFactory.create(fakeConnection);

    const isCreateOperation : boolean = action === 'create';

    const simpleConnectionOptions : SimpleConnectionOptions = buildSimpleConnectionOptions(connectionOptions);
    const customOptions : CustomOptions = buildCustomOptions(connectionOptions);

    if(driver instanceof SqliteDriver) {
        if(isCreateOperation) {
            return await createSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
        } else {
            return await dropSQLiteDatabase(driver, simpleConnectionOptions, customOptions);
        }
    }

    if(driver instanceof MysqlDriver) {
        if(isCreateOperation) {
            return await createMySQLDatabase(driver, simpleConnectionOptions, customOptions);
        } else {
            return await dropMySQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
    }

    if(driver instanceof PostgresDriver) {
        if(isCreateOperation) {
            return await createPostgresDatabase(driver, simpleConnectionOptions, customOptions);
        } else {
            return await dropPostgresDatabase(driver, simpleConnectionOptions, customOptions);
        }
    }

    if(driver instanceof OracleDriver) {
        if(isCreateOperation) {
            return await createOracleDatabase(driver, simpleConnectionOptions, customOptions);
        } else {
            return await dropOracleDatabase(driver, simpleConnectionOptions, customOptions);
        }
    }

    if(driver instanceof SqlServerDriver) {
        if(isCreateOperation) {
            return await createMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
        } else {
            return await dropMsSQLDatabase(driver, simpleConnectionOptions, customOptions);
        }
    }

    throw new NotSupportedDriver(connectionOptions.type);
}

export function buildCustomOptions(connectionOptions: ConnectionWithAdditionalOptions) {
    const options : CustomOptions = {};

    if(typeof connectionOptions?.charset === 'string') {
        options.charset = (connectionOptions as ConnectionWithAdditionalOptions).charset;
    }

    if(typeof connectionOptions?.characterSet === 'string') {
        options.characterSet = (connectionOptions as ConnectionWithAdditionalOptions).characterSet;
    }

    if(typeof connectionOptions?.extra?.charset === 'string') {
        options.charset = connectionOptions.extra.charset;
    }

    if(typeof connectionOptions?.extra?.characterSet === 'string') {
        options.characterSet = connectionOptions.extra.characterSet;
    }

    return options;
}
