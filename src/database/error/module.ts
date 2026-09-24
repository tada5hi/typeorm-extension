import { isObject } from '../../utils';

type DatabaseErrorKind = 'uniqueViolation' | 'foreignKeyViolation' | 'lockConflict';

/**
 * The fields a driver reports its vendor code in. QueryFailedError copies
 * them from the driver error onto itself and keeps the original as
 * `driverError`, so both places are read.
 */
type DatabaseErrorSignature = {
    /**
     * postgres/cockroachdb (SQLSTATE), mysql/mariadb, better-sqlite3 and
     * oracle (`ORA-xxxxx`) as a string; mongodb as a number.
     */
    code?: string | number,
    /**
     * mssql: the server error number. Its `code` is the generic `EREQUEST`.
     */
    number?: number,
    /**
     * oracle: the numeric part of the `ORA-xxxxx` code.
     */
    errorNum?: number,
    message?: string,
};

/**
 * The driver error decides, the wrapper is the fallback: every wrapper has a
 * message of its own, which would hide the driver's (mssql 547 needs it).
 */
function readProperty(input: Record<string, any>, key: string) : unknown {
    if (
        isObject(input.driverError) &&
        typeof input.driverError[key] !== 'undefined'
    ) {
        return input.driverError[key];
    }

    return input[key];
}

function readSignature(input: unknown) : DatabaseErrorSignature | undefined {
    if (!isObject(input)) {
        return undefined;
    }

    const code = readProperty(input, 'code');
    const number = readProperty(input, 'number');
    const errorNum = readProperty(input, 'errorNum');
    const message = readProperty(input, 'message');

    return {
        code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
        number: typeof number === 'number' ? number : undefined,
        errorNum: typeof errorNum === 'number' ? errorNum : undefined,
        message: typeof message === 'string' ? message : undefined,
    };
}

type DatabaseErrorCodes = {
    code: (string | number)[],
    number: number[],
    errorNum: number[],
};

const CODES : Record<DatabaseErrorKind, DatabaseErrorCodes> = {
    uniqueViolation: {
        code: [
            '23505', // postgres, cockroachdb: unique_violation
            'ER_DUP_ENTRY', // mysql, mariadb
            'SQLITE_CONSTRAINT_UNIQUE', // better-sqlite3
            'SQLITE_CONSTRAINT_PRIMARYKEY', // better-sqlite3: a primary key is reported apart
            'ORA-00001', // oracle
            11000, // mongodb: duplicate key
            11001, // mongodb: duplicate key on update (older servers)
        ],
        number: [
            2627, // mssql: unique or primary key constraint
            2601, // mssql: unique index
        ],
        errorNum: [1], // oracle: ORA-00001
    },
    foreignKeyViolation: {
        code: [
            '23503', // postgres, cockroachdb: foreign_key_violation, both directions
            'ER_NO_REFERENCED_ROW', // mysql, mariadb: the referenced row is missing
            'ER_NO_REFERENCED_ROW_2', // same, reported with the constraint name
            'ER_ROW_IS_REFERENCED', // mysql, mariadb: the row is still referenced
            'ER_ROW_IS_REFERENCED_2', // same, reported with the constraint name
            'SQLITE_CONSTRAINT_FOREIGNKEY', // better-sqlite3, both directions
            'ORA-02291', // oracle: parent key not found
            'ORA-02292', // oracle: child record found
        ],
        // mssql 547 is shared with CHECK constraints, see isDatabaseForeignKeyViolationError().
        number: [],
        errorNum: [2291, 2292],
    },
    lockConflict: {
        code: [
            '40P01', // postgres: deadlock_detected
            '40001', // postgres, cockroachdb: serialization_failure
            'ER_LOCK_DEADLOCK', // mysql, mariadb
            'ER_LOCK_WAIT_TIMEOUT', // mysql, mariadb
            'ORA-00060', // oracle: deadlock detected
            'ORA-08177', // oracle: can't serialize access
        ],
        number: [
            1205, // mssql: chosen as deadlock victim
            1222, // mssql: lock request time out period exceeded
        ],
        errorNum: [60, 8177],
    },
};

const MSSQL_CONSTRAINT_CONFLICT = 547;

function matches(signature: DatabaseErrorSignature, codes: DatabaseErrorCodes) : boolean {
    return (typeof signature.code !== 'undefined' && codes.code.includes(signature.code)) ||
        (typeof signature.number !== 'undefined' && codes.number.includes(signature.number)) ||
        (typeof signature.errorNum !== 'undefined' && codes.errorNum.includes(signature.errorNum));
}

/**
 * True when the error is a unique constraint (duplicate key) violation,
 * a primary key included. Two writers inserting the same key at once end
 * like this, and the loser usually wants to answer a conflict.
 *
 * Takes the QueryFailedError typeorm throws, or the raw driver error.
 */
export function isDatabaseUniqueViolationError(error: unknown) : boolean {
    const signature = readSignature(error);

    return !!signature && matches(signature, CODES.uniqueViolation);
}

/**
 * True when the error is a foreign key violation, in either direction:
 * a row references a missing one, or a row still referenced is deleted.
 * postgres, better-sqlite3 and mssql report both with one code, so the
 * statement tells them apart.
 *
 * mssql raises 547 for a CHECK constraint as well, so the message decides:
 * it names a FOREIGN KEY constraint when the referenced row is missing and a
 * REFERENCE constraint when a referenced row is deleted.
 */
export function isDatabaseForeignKeyViolationError(error: unknown) : boolean {
    const signature = readSignature(error);
    if (!signature) {
        return false;
    }

    if (
        signature.number === MSSQL_CONSTRAINT_CONFLICT &&
        typeof signature.message === 'string' &&
        (
            signature.message.includes('FOREIGN KEY constraint') ||
            signature.message.includes('REFERENCE constraint')
        )
    ) {
        return true;
    }

    return matches(signature, CODES.foreignKeyViolation);
}

/**
 * True when the database gave up on the transaction because of lock
 * contention: a deadlock, a serialization failure or a lock wait timeout.
 *
 * Re-running the whole transaction is the usual answer, and it is only sound
 * when the transaction derives its writes from reads made inside it. A lock
 * wait timeout rolls back just the statement on mysql, mariadb and mssql, so
 * roll back the transaction before retrying (typeorm's `transaction()` does).
 *
 * better-sqlite3 and mongodb are not covered. Unrelated to DatabaseLockError,
 * which withDatabaseLock throws when its advisory lock can not be acquired.
 */
export function isDatabaseLockConflictError(error: unknown) : boolean {
    const signature = readSignature(error);

    return !!signature && matches(signature, CODES.lockConflict);
}
