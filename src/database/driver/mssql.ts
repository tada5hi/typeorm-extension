import type { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import { OptionsError } from '../../errors';
import type { DatabaseCreateContext, DatabaseDropContext } from '../type';
import type { DriverOptions } from './type';
import { buildDriverOptions, createDriver } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, setupDatabaseSchema } from '../utils';

export async function createSimpleMsSQLConnection(
    driver: SqlServerDriver,
    options: DriverOptions,
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
    context?: DatabaseCreateContext,
) {
    context = await buildDatabaseCreateContext(context);
    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as SqlServerDriver;

    const connection = await createSimpleMsSQLConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
     */
    let query = context.ifNotExist ?
        `IF DB_ID('${options.database}') IS NULL CREATE DATABASE "${options.database}"` :
        `CREATE DATABASE "${options.database}"`;

    if (typeof options.characterSet === 'string') {
        query += ` CHARACTER SET ${options.characterSet}`;
    }

    const result = await connection.query(query);

    if (context.synchronize) {
        await setupDatabaseSchema(context.options);
    }

    return result;
}

export async function dropMsSQLDatabase(
    context?: DatabaseDropContext,
) {
    context = await buildDatabaseDropContext(context);
    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as SqlServerDriver;

    const connection = await createSimpleMsSQLConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
     */
    const query = context.ifExist ?
        `IF DB_ID('${options.database}') IS NOT NULL DROP DATABASE "${options.database}"` :
        `DROP DATABASE "${options.database}"`;

    return connection.query(query);
}
