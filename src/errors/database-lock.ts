import { TypeormExtensionError } from './base';

export class DatabaseLockError extends TypeormExtensionError {
    static timeout(name: string, timeout: number) {
        return new DatabaseLockError(`The database lock ${name} could not be acquired within ${timeout}ms.`);
    }

    static transactionActive(name: string) {
        return new DatabaseLockError(
            `The database lock ${name} can not be taken inside a transaction, it would outlive a rollback.`,
        );
    }

    static transactionLeftOpen(name: string) {
        return new DatabaseLockError(
            `The callback of the database lock ${name} left a transaction open, which has been rolled back.`,
        );
    }

    /**
     * The release statement failed. The session has been ended instead of
     * going back to the pool, which frees the lock: the query runner is
     * released and can not be used any further.
     */
    static releaseFailed(name: string, cause: unknown) {
        return new DatabaseLockError(
            `The database lock ${name} could not be released, the session has been ended instead.`,
            { cause },
        );
    }
}
