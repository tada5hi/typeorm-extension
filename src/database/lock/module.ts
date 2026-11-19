import type { QueryRunner } from 'typeorm';
import { DatabaseLockError, DriverError } from '../../errors';
import type { DatabaseLockOptions } from './types';

type DatabaseLockStatements = {
    acquire: string,
    release: string,
    /**
     * End the session instead of letting it go back to the pool, which frees
     * every lock it holds. Used when the release statement failed. Must not
     * throw, and must leave the query runner released.
     */
    discard: (queryRunner: QueryRunner, error: unknown) => Promise<void>,
};

/**
 * typeorm keeps `releasePostgresConnection` private: handing an error to
 * pg's release callback makes the pool destroy the client instead of
 * reusing it. It sets `isReleased`, so a later `release()` is a no-op.
 */
type PostgresQueryRunnerInternals = {
    releasePostgresConnection?: (error?: unknown) => Promise<void>,
};

async function discardPostgresSession(queryRunner: QueryRunner, error: unknown) : Promise<void> {
    const runner = queryRunner as unknown as PostgresQueryRunnerInternals;

    try {
        if (typeof runner.releasePostgresConnection === 'function') {
            await runner.releasePostgresConnection(error instanceof Error ? error : new Error(String(error)));
        } else {
            await queryRunner.release();
        }
    } catch {
        // the session is ended as far as it can be
    }
}

/**
 * The connection is protected on typeorm's query runner. mysql2's
 * `PoolConnection.destroy()` removes it from the pool, so the later
 * `release()` of the caller is a no-op.
 */
type MysqlQueryRunnerInternals = {
    databaseConnection?: { destroy?: () => void },
    isReleased: boolean,
};

async function discardMysqlSession(queryRunner: QueryRunner) : Promise<void> {
    const runner = queryRunner as unknown as MysqlQueryRunnerInternals;

    try {
        const connection = runner.databaseConnection;

        if (connection && typeof connection.destroy === 'function') {
            connection.destroy();
        }
    } catch {
        // the connection is unusable either way
    }

    runner.isReleased = true;
}

const MYSQL_LOCK_STATEMENTS : DatabaseLockStatements = {
    // A named lock is global to the server: namespace it with the database,
    // hashed (SHA2-256, 64 hex characters: mysql 9.7 has no SHA1) to stay
    // within the 64 character limit. COALESCE: without a selected database
    // mariadb would answer GET_LOCK(NULL) with NULL instead of an error.
    acquire: 'SELECT GET_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256), 0) AS `acquired`',
    release: 'SELECT RELEASE_LOCK(SHA2(CONCAT(COALESCE(DATABASE(), \'\'), \':\', ?), 256)) AS `released`',
    discard: discardMysqlSession,
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
        discard: discardPostgresSession,
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
 * If the release statement fails (e.g. postgres refuses it in a transaction
 * a failed rollback left aborted), the session is ended instead of going
 * back to the pool, which frees the lock. The query runner is released
 * then and can not be used any further. Ending the session frees the locks
 * of enclosing calls on it as well: a callback which catches the error of a
 * nested call and carries on runs without the lock.
 *
 * The lock is session scoped: the query runner must stay on one connection
 * for the whole call, which a typeorm QueryRunner does until it is released.
 * Nested calls with the same name on the same query runner do not block.
 *
 * Supported for postgres, mysql and mariadb.
 *
 * @throws DriverError on any other driver, unless `strict` is false.
 * @throws DatabaseLockError if the lock can not be acquired within `timeout`,
 * the query runner is in a transaction, or the callback left one open.
 * @throws DatabaseLockError (`releaseFailed`, the release error as `cause`)
 * if the callback returned but the release failed. It takes precedence over
 * a transaction the callback left open. If the callback threw, its error is
 * rethrown instead.
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
        if (options.strict === false) {
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

        // A failed release must not hide the callback's error.
        await releaseLock(queryRunner, statement, name);

        throw e;
    }

    // Committing it after the lock is gone would defeat the lock.
    const transactionLeftOpen = await rollbackTransaction(queryRunner);

    const release = await releaseLock(queryRunner, statement, name);

    // The query runner is gone: that matters more than the open transaction.
    if (!release.released) {
        throw DatabaseLockError.releaseFailed(name, release.error);
    }

    if (transactionLeftOpen) {
        throw DatabaseLockError.transactionLeftOpen(name);
    }

    return output;
}

/**
 * Release the lock, or end the session if the release fails: a session which
 * goes back to the pool still holding the lock would block every later
 * caller with the same name forever.
 */
async function releaseLock(
    queryRunner: QueryRunner,
    statement: DatabaseLockStatements,
    name: string,
) : Promise<{ released: true } | { released: false, error: unknown }> {
    try {
        await queryRunner.query(statement.release, [name]);

        return { released: true };
    } catch (e) {
        await statement.discard(queryRunner, e);

        return { released: false, error: e };
    }
}

/**
 * A transaction the callback left open (or postgres aborted) would make
 * postgres refuse the release, and the session would have to be ended.
 *
 * Nested transactions are savepoints in typeorm: one rollback only unwinds
 * the innermost, so repeat until the outer one is gone (or a rollback fails).
 */
async function rollbackTransaction(queryRunner: QueryRunner) : Promise<boolean> {
    if (!queryRunner.isTransactionActive) {
        return false;
    }

    try {
        while (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
        }
    } catch {
        // the release below is the one left to fail, or the connection is gone
    }

    return true;
}
