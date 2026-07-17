import type { ConnectionParams } from '../type';

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
 */
export function buildMsSQLCreateDatabaseQuery(params: ConnectionParams, ifNotExist: boolean): string {
    let query = ifNotExist ?
        `IF DB_ID('${params.database}') IS NULL CREATE DATABASE "${params.database}"` :
        `CREATE DATABASE "${params.database}"`;

    if (typeof params.characterSet === 'string') {
        query += ` CHARACTER SET ${params.characterSet}`;
    }

    return query;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
 */
export function buildMsSQLDropDatabaseQuery(database: string, ifExist: boolean): string {
    return ifExist ?
        `IF DB_ID('${database}') IS NOT NULL DROP DATABASE "${database}"` :
        `DROP DATABASE "${database}"`;
}
