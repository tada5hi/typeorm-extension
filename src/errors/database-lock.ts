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
}
