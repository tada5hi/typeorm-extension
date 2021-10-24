import {parseQueryPagination} from "@trapi/query";
import {SelectQueryBuilder} from "typeorm";
import {PaginationApplyOptions, PaginationApplyOutput} from "./type";

/**
 * Apply parsed page/pagination parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyParsedQueryPagination<T>(
    query: SelectQueryBuilder<T>,
    data: PaginationApplyOutput
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
export function applyQueryPagination<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: PaginationApplyOptions
) : PaginationApplyOutput {
    return applyParsedQueryPagination(query, parseQueryPagination(data, options));
}

/**
 * Apply raw page/pagination parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyPagination<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: PaginationApplyOptions
) : PaginationApplyOutput {
    return applyQueryPagination(query, data, options);
}
