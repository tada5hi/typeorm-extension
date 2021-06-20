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

export async function createDatabase(connectionOptions: ConnectionOptions) {
    return await createOrDropDatabase(connectionOptions, 'create');
}

export async function dropDatabase(connectionOptions: ConnectionOptions) {
    return await createOrDropDatabase(connectionOptions, 'drop');
}

async function createOrDropDatabase(
    connectionOptions: ConnectionOptions,
    action: 'create' | 'drop'
) {
    const fakeConnection : Connection = {
        options: {
            type: connectionOptions.type
        }
    } as Connection;

    const driverFactory = new DriverFactory();
    const driver = driverFactory.create(fakeConnection);

    const isCreateOperation : boolean = action === 'create';

    if(driver instanceof SqliteDriver) {
        return;
    }

    const simpleConnectionOptions : SimpleConnectionOptions = buildSimpleConnectionOptions(connectionOptions);

    if(driver instanceof MysqlDriver) {
        if(isCreateOperation) {
            return await createMySQLDatabase(driver, simpleConnectionOptions);
        } else {
            return await dropMySQLDatabase(driver, simpleConnectionOptions);
        }
    }

    if(driver instanceof PostgresDriver) {
        if(isCreateOperation) {
            return await createPostgresDatabase(driver, simpleConnectionOptions);
        } else {
            return await dropPostgresDatabase(driver, simpleConnectionOptions);
        }
    }

    if(driver instanceof OracleDriver) {
        if(isCreateOperation) {
            return await createOracleDatabase(driver, simpleConnectionOptions);
        } else {
            return await dropOracleDatabase(driver, simpleConnectionOptions);
        }
    }

    if(driver instanceof SqlServerDriver) {
        if(isCreateOperation) {
            return await createMsSQLDatabase(driver, simpleConnectionOptions);
        } else {
            return await dropMsSQLDatabase(driver, simpleConnectionOptions);
        }
    }
}
