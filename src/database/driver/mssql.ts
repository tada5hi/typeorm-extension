import { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';

import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';

export async function createSimpleMsSQLConnection(
    driver: SqlServerDriver,
    connectionOptions: DriverConnectionOptions,
) {
    const option : Record<string, any> = {
        user: connectionOptions.user,
        password: connectionOptions.password,
        server: connectionOptions.host,
        port: connectionOptions.port || 1433,
        ...(connectionOptions.extra ? connectionOptions.extra : {}),
        ...(connectionOptions.domain ? { domain: connectionOptions.domain } : {}),
    };

    await driver.mssql.connect(option);

    return driver.mssql;
}

export async function createMsSQLDatabase(
    driver: SqlServerDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimpleMsSQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
     */
    let query = customOptions.ifNotExist ?
        `IF DB_ID('${connectionOptions.database}') IS NULL CREATE DATABASE "${connectionOptions.database}"` :
        `CREATE DATABASE "${connectionOptions.database}"`;

    if (typeof customOptions.characterSet === 'string') {
        query += ` CHARACTER SET ${customOptions.characterSet}`;
    }

    return connection.query(query);
}

export async function dropMsSQLDatabase(
    driver: SqlServerDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const connection = await createSimpleMsSQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
     */
    const query = customOptions.ifExist ?
        `IF DB_ID('${connectionOptions.database}') IS NOT NULL DROP DATABASE "${connectionOptions.database}"` :
        `DROP DATABASE "${connectionOptions.database}"`;

    return connection.query(query);
}
