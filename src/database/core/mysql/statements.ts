import type { ConnectionParams } from '../type';

export const MYSQL_FOREIGN_KEY_CHECKS_OFF = 'SET FOREIGN_KEY_CHECKS=0;';

export const MYSQL_FOREIGN_KEY_CHECKS_ON = 'SET FOREIGN_KEY_CHECKS=1;';

export const MYSQL_FOREIGN_KEY_CHECKS_SELECT = 'SELECT @@SESSION.foreign_key_checks AS `value`;';

/**
 * Infer the CHARACTER SET from a collation (charset) when it is not
 * explicitly configured, e.g. utf8mb4_general_ci -> utf8mb4.
 */
export function deriveMySQLCharacterSet(charset: string, characterSet?: string): string | undefined {
    if (typeof characterSet === 'string') {
        return characterSet;
    }

    if (charset.toLowerCase().startsWith('utf8mb4')) {
        return 'utf8mb4';
    }

    if (charset.toLowerCase().startsWith('utf8')) {
        return 'utf8';
    }

    return undefined;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L297
 */
export function buildMySQLCreateDatabaseQuery(params: ConnectionParams, ifNotExist: boolean): string {
    let query = ifNotExist ?
        `CREATE DATABASE IF NOT EXISTS \`${params.database}\`` :
        `CREATE DATABASE \`${params.database}\``;

    if (typeof params.charset === 'string') {
        const characterSet = deriveMySQLCharacterSet(params.charset, params.characterSet);

        if (typeof characterSet === 'string') {
            query += ` CHARACTER SET ${characterSet} COLLATE ${params.charset}`;
        }
    }

    return query;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/mysql/MysqlQueryRunner.ts#L306
 */
export function buildMySQLDropDatabaseQuery(database: string, ifExist: boolean): string {
    return ifExist ?
        `DROP DATABASE IF EXISTS \`${database}\`` :
        `DROP DATABASE \`${database}\``;
}
