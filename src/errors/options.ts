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

    static lockWhereRelation(property: string) {
        return new OptionsError(
            `The locked row can not be looked up through the relation ${property}, the join would lock its rows too. ` +
            'Use a find operator on it (e.g. Equal(id)) or the row\'s own columns.',
        );
    }

    static envDriverMissing(names: string[]) {
        return new OptionsError(
            `The environment sets ${names.join(', ')} (or a TYPEORM_* alias), but names no driver: ` +
            'set DB_TYPE (or TYPEORM_CONNECTION), or give DB_URL a scheme.',
        );
    }

    static envMissing() {
        return new OptionsError(
            'The environment names no database: set DB_TYPE (or TYPEORM_CONNECTION) and its connection settings, ' +
            'or DB_URL.',
        );
    }

    static databaseNotDefined() {
        return new OptionsError('The database name to connect to is not defined.');
    }
}
