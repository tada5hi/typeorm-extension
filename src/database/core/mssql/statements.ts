import type { ConnectionParams } from '../type';

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L416
 *
 * NOTE: the previous implementation appended a `CHARACTER SET` clause,
 * which is not valid T-SQL (SQL Server uses `COLLATE <collation_name>`).
 * The clause was removed; a proper collation option is future work.
 */
export function buildMsSQLCreateDatabaseQuery(params: ConnectionParams, ifNotExist: boolean): string {
    return ifNotExist ?
        `IF DB_ID('${params.database}') IS NULL CREATE DATABASE "${params.database}"` :
        `CREATE DATABASE "${params.database}"`;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/sqlserver/SqlServerQueryRunner.ts#L425
 */
export function buildMsSQLDropDatabaseQuery(database: string, ifExist: boolean): string {
    return ifExist ?
        `IF DB_ID('${database}') IS NOT NULL DROP DATABASE "${database}"` :
        `DROP DATABASE "${database}"`;
}
