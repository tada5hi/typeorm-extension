import { RelationsParseOutput, parseQueryRelations } from 'rapiq';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix } from '../../utils';
import { RelationsApplyOptions, RelationsApplyOutput } from './type';

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
    options?: RelationsApplyOptions<T>,
) : RelationsApplyOutput {
    options = options || {};
    for (let i = 0; i < data.length; i++) {
        const parts = data[i].key.split('.');

        let key : string;
        if (parts.length > 1) {
            key = parts.slice(-2).join('.');
        } else {
            key = buildKeyWithPrefix(data[i].key, options.defaultAlias);
        }

        data[i].key = key;

        /* istanbul ignore next */
        query.leftJoinAndSelect(key, data[i].value);
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
    options?: RelationsApplyOptions<T>,
) : RelationsApplyOutput {
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
    options?: RelationsApplyOptions<T>,
) : RelationsApplyOutput {
    return applyQueryRelations(query, data, options);
}
