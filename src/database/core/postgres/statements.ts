import type { ConnectionParams } from '../type';

export function buildPostgresDatabaseExistsQuery(database: string): string {
    return `SELECT * FROM pg_database WHERE lower(datname) = lower('${database}');`;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L326
 */
export function buildPostgresCreateDatabaseQuery(params: ConnectionParams): string {
    let query = `CREATE DATABASE "${params.database}"`;

    if (typeof params.template === 'string') {
        query += ` TEMPLATE "${params.template}"`;
    } else if (typeof params.characterSet === 'string') {
        query += ` WITH ENCODING '${params.characterSet}'`;
    }

    return query;
}

export function buildPostgresCreateSchemaQuery(schema: string): string {
    return `CREATE SCHEMA IF NOT EXISTS "${schema}"`;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresQueryRunner.ts#L343
 */
export function buildPostgresDropDatabaseQuery(database: string, ifExist: boolean): string {
    return ifExist ?
        `DROP DATABASE IF EXISTS "${database}"` :
        `DROP DATABASE "${database}"`;
}
