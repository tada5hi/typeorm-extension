import { TypeormExtensionError } from './base';

export class DriverError extends TypeormExtensionError {
    constructor(message?: string) {
        super(message || 'A database driver related error has occurred.');
    }

    static undeterminable() {
        return new DriverError('The driver could not be determined.');
    }

    static notSupported(driverName: string) {
        return new DriverError(`The driver ${driverName} is not supported yet.`);
    }

    static connectionClosed() {
        return new DriverError('The database connection has already been closed.');
    }

    static databaseNotFound(database: string) {
        return new DriverError(`The database ${database} does not exist.`);
    }
}
