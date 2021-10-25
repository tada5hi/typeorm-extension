import {parseQueryRelations, RelationsParseOutput} from "@trapi/query";
import {SelectQueryBuilder} from "typeorm";
import {RelationsApplyOptions, RelationsApplyOutput} from "./type";

/**
 * Apply parsed include/relation parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyQueryRelationsParseOutput<T>(
    query: SelectQueryBuilder<T>,
    data: RelationsParseOutput
) : RelationsApplyOutput {
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
    options?: RelationsApplyOptions
) : RelationsApplyOutput {
    return applyQueryRelationsParseOutput(query, parseQueryRelations(data, options));
}

/**
 * Apply raw include/relations parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyRelations<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: RelationsApplyOptions
) : RelationsApplyOutput {
    return applyQueryRelations(query, data, options);
}
