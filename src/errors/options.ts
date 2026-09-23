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

    static timezoneUnsupported(timezone: unknown) {
        return new OptionsError(`The database timezone ${String(timezone)} is not supported, only UTC is.`);
    }

    static timezoneConflict(detail: string) {
        return new OptionsError(`The database timezone can not be pinned: ${detail}`);
    }

    static databaseNotDefined() {
        return new OptionsError('The database name to connect to is not defined.');
    }
}
