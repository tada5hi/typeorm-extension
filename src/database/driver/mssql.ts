import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';

import { DriverConnectionOptions } from '../../connection';
import { DatabaseCreateOperationContext, DatabaseDeleteOperationContext } from '../type';

export async function createSimpleMsSQLConnection(
    driver: SqlServerDriver,
    options: DriverConnectionOptions,
) {
    const option : Record<string, any> = {
        user: options.user,
        password: options.password,
        server: options.host,
        port: options.port || 1433,
        ...(options.extra ? options.extra : {}),
        ...(options.domain ? { domain: options.domain } : {}),
    };

    await driver.mssql.connect(option);

    return driver.mssql;
}

export async function createMsSQLDatabase(
    driver: SqlServerDriver,
    options: DriverConnectionOptions,
    operationContext: DatabaseCreateOperationContext,
) {
    const connection = await createSimpleMsSQLConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
     */
    let query = operationContext.ifNotExist ?
        `IF DB_ID('${options.database}') IS NULL CREATE DATABASE "${options.database}"` :
        `CREATE DATABASE "${options.database}"`;

    if (typeof options.characterSet === 'string') {
        query += ` CHARACTER SET ${options.characterSet}`;
    }

    return connection.query(query);
}

export async function dropMsSQLDatabase(
    driver: SqlServerDriver,
    connectionOptions: DriverConnectionOptions,
    operationContext: DatabaseDeleteOperationContext,
) {
    const connection = await createSimpleMsSQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
     */
    const query = operationContext.ifExist ?
        `IF DB_ID('${connectionOptions.database}') IS NOT NULL DROP DATABASE "${connectionOptions.database}"` :
        `DROP DATABASE "${connectionOptions.database}"`;

    return connection.query(query);
}
