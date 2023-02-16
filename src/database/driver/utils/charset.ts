import type { DataSourceOptions } from 'typeorm';
import { hasOwnProperty } from '../../../utils';

export function getCharsetFromDataSourceOptions(options: DataSourceOptions) : string | undefined {
    if (
        hasOwnProperty(options, 'charset') &&
        typeof options.charset === 'string'
    ) {
        return options.charset;
    }

    if (typeof options?.extra?.charset === 'string') {
        return options.extra.charset;
    }

    return undefined;
}
