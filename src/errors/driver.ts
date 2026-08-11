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

    static schemaAlterationNotSupported(driverName: string) {
        return new DriverError(`Schema alterations are not supported for the driver ${driverName}.`);
    }

    static columnConversionExpressionNotSupported(driverName: string) {
        return new DriverError(
            `A conversion expression (\`using\`) can not be expressed for the driver ${driverName}, ` +
            'which would convert the values on its own terms instead.',
        );
    }

    static columnGenerationExpressionUnknown(columnName: string) {
        return new DriverError(
            `The generation expression of the column ${columnName} could not be read back, ` +
            'and altering it would turn it into a regular column.',
        );
    }

    static connectionClosed() {
        return new DriverError('The database connection has already been closed.');
    }

    static databaseNotFound(database: string) {
        return new DriverError(`The database ${database} does not exist.`);
    }
}
