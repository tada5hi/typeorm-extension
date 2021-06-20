import {SqlServerDriver} from "typeorm/driver/sqlserver/SqlServerDriver";
import {SimpleConnectionOptions} from "../../connection";

export async function createSimpleMsSQLConnection(
    driver: SqlServerDriver,
    connectionOptions: SimpleConnectionOptions
) {
    let option : Record<string,any> | string;

    if(typeof connectionOptions.url === 'string') {
        option = connectionOptions.url;
    } else {
        option = {
            user: connectionOptions.user,
            password: connectionOptions.password,
            server: connectionOptions.host,
            port: connectionOptions.port ?? 1433
        }
    }

    await driver.mssql.connect(option);

    return driver.mssql;
}

export async function createMsSQLDatabase(
    driver: SqlServerDriver,
    connectionOptions: SimpleConnectionOptions,
    ifNotExist?: boolean
) {
    const connection = await createSimpleMsSQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
     */
    const query = ifNotExist ?
        `IF DB_ID('${connectionOptions.database}') IS NULL CREATE DATABASE "${connectionOptions.database}"` :
        `CREATE DATABASE "${connectionOptions.database}"`;

    return await connection.query(query);
}

export async function dropMsSQLDatabase(
    driver: SqlServerDriver,
    connectionOptions: SimpleConnectionOptions,
    ifExist?: boolean
) {
    const connection = await createSimpleMsSQLConnection(driver, connectionOptions);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
     */
    const query = ifExist ?
        `IF DB_ID('${connectionOptions.database}') IS NOT NULL DROP DATABASE "${connectionOptions.database}"` :
        `DROP DATABASE "${connectionOptions.database}"`;

    return await connection.query(query);
}
