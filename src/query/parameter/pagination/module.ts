import type { ObjectLiteral } from 'rapiq';
import { parseQueryPagination } from 'rapiq';
import type { SelectQueryBuilder } from 'typeorm';
import type { QueryPaginationApplyOptions, QueryPaginationApplyOutput } from './type';

/**
 * Apply parsed page/pagination parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyQueryPaginationParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: QueryPaginationApplyOutput,
) {
    /* istanbul ignore next */
    if (typeof data.limit !== 'undefined') {
        query.take(data.limit);

        if (typeof data.offset === 'undefined') {
            query.skip(0);
        }
    }

    /* istanbul ignore next */
    if (typeof data.offset !== 'undefined') {
        query.skip(data.offset);
    }

    return data;
}

/**
 * Apply raw page/pagination parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryPagination<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryPaginationApplyOptions,
) : QueryPaginationApplyOutput {
    return applyQueryPaginationParseOutput(query, parseQueryPagination(data, options));
}

/**
 * Apply raw page/pagination parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyPagination<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryPaginationApplyOptions,
) : QueryPaginationApplyOutput {
    return applyQueryPagination(query, data, options);
}
