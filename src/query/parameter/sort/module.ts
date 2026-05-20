import type { SortDirection, SortParseOutput } from 'rapiq';
import { parseQuerySort } from 'rapiq';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix } from '../../utils';
import type { QuerySortApplyOptions, QuerySortApplyOutput } from './type';

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
) : QuerySortApplyOutput {
    if (data.length === 0) {
        return data;
    }

    const sort : Record<string, `${SortDirection}`> = {};

    for (const datum of data) {
        const key = buildKeyWithPrefix(datum.key, datum.path);

        sort[key] = datum.value;
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
    options?: QuerySortApplyOptions<T>,
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
    options?: QuerySortApplyOptions<T>,
) : SortParseOutput {
    return applyQuerySort(query, data, options);
}
