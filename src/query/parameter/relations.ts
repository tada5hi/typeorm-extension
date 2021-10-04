import {parseQueryRelations, RelationsParseOutput, RelationsParseOptions} from "@trapi/query";
import {SelectQueryBuilder} from "typeorm";

/**
 * Apply parsed include/relation parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyParsedQueryRelations<T>(
    query: SelectQueryBuilder<T>,
    data: RelationsParseOutput
) : RelationsParseOutput {
    for (let i=0; i<data.length; i++) {
        /* istanbul ignore next */
        query.leftJoinAndSelect(data[i].key, data[i].value);
    }

    return data;
}

/**
 * Apply raw include/relations parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryRelations<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: RelationsParseOptions
) : RelationsParseOutput {
    return applyParsedQueryRelations(query, parseQueryRelations(data, options));
}
