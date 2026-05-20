import type { RelationsParseOutput } from 'rapiq';
import { parseQueryRelations } from 'rapiq';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix } from '../../utils';
import type { QueryRelationsApplyOptions, QueryRelationsApplyOutput } from './type';

/**
 * Apply parsed include/relation parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryRelationsParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: RelationsParseOutput,
    options: QueryRelationsApplyOptions<T> = {},
) : QueryRelationsApplyOutput {
    for (const datum of data) {
        const parts = datum.key.split('.');

        let key : string;
        if (parts.length > 1) {
            key = parts.slice(-2).join('.');
        } else {
            key = buildKeyWithPrefix(datum.key, options.defaultAlias);
        }

        datum.key = key;

        /* istanbul ignore next */
        query.leftJoinAndSelect(key, datum.value);

        if (options.onJoin) {
            options.onJoin(key, datum.value, query);
        }
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
export function applyQueryRelations<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options: QueryRelationsApplyOptions<T> = {},
) : QueryRelationsApplyOutput {
    return applyQueryRelationsParseOutput(query, parseQueryRelations(data, options), options);
}

/**
 * Apply raw include/relations parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyRelations<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options: QueryRelationsApplyOptions<T> = {},
) : QueryRelationsApplyOutput {
    return applyQueryRelations(query, data, options);
}
