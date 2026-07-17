/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L347
 *
 * The double space after the IF NOT EXISTS clause is preserved
 * from the previous implementation.
 */
export function buildCockroachDBCreateDatabaseQuery(database: string, ifNotExist: boolean): string {
    return `CREATE DATABASE ${ifNotExist ? 'IF NOT EXISTS ' : ''} "${database}"`;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/cockroachdb/CockroachQueryRunner.ts#L356
 */
export function buildCockroachDBDropDatabaseQuery(database: string, ifExist: boolean): string {
    return `DROP DATABASE ${ifExist ? 'IF EXISTS ' : ''} "${database}"`;
}
