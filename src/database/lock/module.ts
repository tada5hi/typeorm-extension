import type { QueryRunner } from 'typeorm';
import { DatabaseLockError, DriverError } from '../../errors';
import type { DatabaseLockOptions } from './type';

type DatabaseLockStatements = {
    acquire: string,
    release: string,
};

const MYSQL_LOCK_STATEMENTS : DatabaseLockStatements = {
    // A named lock is global to the server: namespace it with the database,
    // hashed (SHA2-256, 64 hex characters: mysql 9.7 has no SHA1) to stay
    // within the 64 character limit. COALESCE: without a selected database
    // mariadb would answer GET_LOCK(NULL) with NULL instead of an error.
    acquire: 'SELECT GET_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256), 0) AS `acquired`',
    release: 'SELECT RELEASE_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256)) AS `released`',
};

/**
 * cockroachdb accepts the postgres advisory lock functions, but they do not
 * lock anything, so it is deliberately missing.
 */
const statements = new Map<string, DatabaseLockStatements>([
    ['postgres', {
        // The name as a bigint key. An advisory lock is scoped to the database.
        acquire: 'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS "acquired"',
        release: 'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS "released"',
    }],
    ['mysql', MYSQL_LOCK_STATEMENTS],
    ['mariadb', MYSQL_LOCK_STATEMENTS],
]);

// ponytail: fixed poll interval, make it an option if a caller needs a finer one.
const POLL_INTERVAL = 100;

/**
 * pg answers with a boolean, mysql with the string '1' / '0', mariadb with
 * the number 1 / 0 (either may be NULL). A truthiness check would read '0'
 * as acquired.
 */
export function isDatabaseLockAcquired(rows: unknown) : boolean {
    if (!Array.isArray(rows) || rows.length === 0) {
        return false;
    }

    const value = Object.values(rows[0] ?? {})[0];

    return value === true || value === 1 || value === '1';
}

/**
 * Run a callback while holding a named advisory lock, so that only one
 * session at a time (across processes) runs it. The lock is released
 * afterwards, also when the callback throws. A transaction the callback
 * leaves open on the query runner is rolled back first.
 *
 * The lock is session scoped: the query runner must stay on one connection
 * for the whole call, which a typeorm QueryRunner does until it is released.
 * Nested calls with the same name on the same query runner do not block.
 *
 * Supported for postgres, mysql and mariadb.
 *
 * @throws DriverError on any other driver, unless `silent` is set.
 * @throws DatabaseLockError if the lock can not be acquired within `timeout`,
 * the query runner is in a transaction, or the callback left one open.
 */
export async function withDatabaseLock<T>(
    queryRunner: QueryRunner,
    name: string,
    fn: () => Promise<T>,
    options: DatabaseLockOptions = {},
) : Promise<T> {
    const { type } = queryRunner.dataSource.options;
    const statement = statements.get(type);
    if (!statement) {
        if (options.silent) {
            return fn();
        }

        throw DriverError.lockNotSupported(type);
    }

    // The lock outlives a rollback, and postgres refuses the release in an
    // aborted transaction: it would go back to the pool still held.
    if (queryRunner.isTransactionActive) {
        throw DatabaseLockError.transactionActive(name);
    }

    const timeout = options.timeout ?? Infinity;
    const deadline = Date.now() + timeout;

    while (!isDatabaseLockAcquired(await queryRunner.query(statement.acquire, [name]))) {
        const remaining = deadline - Date.now();
        // negated, so a NaN timeout gives up instead of polling forever.
        if (!(remaining > 0)) {
            throw DatabaseLockError.timeout(name, timeout);
        }

        await new Promise((resolve) => {
            setTimeout(resolve, Math.min(POLL_INTERVAL, remaining));
        });
    }

    let output : T;
    try {
        output = await fn();
    } catch (e) {
        await rollbackTransaction(queryRunner);
        // Only a lost connection is left to fail the release here, and that
        // frees the lock anyway: it must not hide the callback's error.
        await queryRunner.query(statement.release, [name]).catch(() => undefined);
        throw e;
    }

    // Committing it after the lock is gone would defeat the lock.
    const transactionLeftOpen = await rollbackTransaction(queryRunner);
    await queryRunner.query(statement.release, [name]);

    if (transactionLeftOpen) {
        throw DatabaseLockError.transactionLeftOpen(name);
    }

    return output;
}

/**
 * A transaction the callback left open (or postgres aborted) would make
 * postgres refuse the release, and the lock would go back to the pool held.
 */
async function rollbackTransaction(queryRunner: QueryRunner) : Promise<boolean> {
    if (!queryRunner.isTransactionActive) {
        return false;
    }

    await queryRunner.rollbackTransaction().catch(() => undefined);

    return true;
}
