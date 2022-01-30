import { ConnectionWithAdditionalOptions, DatabaseOperationOptions } from '../type';

export function extendDatabaseOperationOptions(
    options: DatabaseOperationOptions,
    connectionOptions: ConnectionWithAdditionalOptions,
) {
    if (typeof connectionOptions?.charset === 'string') {
        options.charset = (connectionOptions as ConnectionWithAdditionalOptions).charset;
    }

    if (typeof connectionOptions?.characterSet === 'string') {
        options.characterSet = (connectionOptions as ConnectionWithAdditionalOptions).characterSet;
    }

    if (typeof connectionOptions?.extra?.charset === 'string') {
        options.charset = connectionOptions.extra.charset;
    }

    if (typeof connectionOptions?.extra?.characterSet === 'string') {
        options.characterSet = connectionOptions.extra.characterSet;
    }

    return options;
}
