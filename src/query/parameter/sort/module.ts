import { SortDirection, SortParseOutput, parseQuerySort } from 'rapiq';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix } from '../../utils';
import { SortApplyOptions, SortApplyOutput } from './type';

// --------------------------------------------------

/**
 * Apply parsed sort parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyQuerySortParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: SortParseOutput,
) : SortApplyOutput {
    if (data.length === 0) {
        return data;
    }

    const sort : Record<string, `${SortDirection}`> = {};

    for (let i = 0; i < data.length; i++) {
        const key = buildKeyWithPrefix(data[i].key, data[i].path);

        sort[key] = data[i].value;
    }

    query.orderBy(sort);

    return data;
}

/**
 * Apply raw sort parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQuerySort<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: SortApplyOptions<T>,
) : SortParseOutput {
    options = options || {};
    if (options.defaultAlias) {
        options.defaultPath = options.defaultAlias;
    }

    return applyQuerySortParseOutput(query, parseQuerySort(data, options));
}

/**
 * Apply raw sort parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applySort<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: SortApplyOptions<T>,
) : SortParseOutput {
    return applyQuerySort(query, data, options);
}
