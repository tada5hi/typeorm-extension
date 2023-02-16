import type { DataSourceOptions } from 'typeorm';
import { hasOwnProperty } from '../../../utils';

export function getCharacterSetFromDataSourceOptions(options: DataSourceOptions) : string | undefined {
    if (
        hasOwnProperty(options, 'characterSet') &&
        typeof options.characterSet === 'string'
    ) {
        return options.characterSet;
    }

    if (typeof options?.extra?.characterSet === 'string') {
        return options.extra.characterSet;
    }

    return undefined;
}
