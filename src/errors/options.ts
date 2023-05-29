import { TypeormExtensionError } from './base';

export class OptionsError extends TypeormExtensionError {
    constructor(message?: string) {
        super(message || 'A database options related error has occurred');
    }

    static undeterminable() {
        return new OptionsError('The database options could not be determined.');
    }

    static notFound() {
        return new OptionsError('The database options could not be located/loaded.');
    }

    static databaseNotDefined() {
        return new OptionsError('The database name to connect to is not defined.');
    }
}
