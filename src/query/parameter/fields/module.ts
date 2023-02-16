import {
    parseQueryFields,
} from 'rapiq';

import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { buildKeyWithPrefix, getAliasForPath } from '../../utils';
import type { QueryFieldsApplyOptions, QueryFieldsApplyOutput } from './type';

/**
 * Apply parsed fields parameter data on the db query.
 *
 * @param query
 * @param data
 */
/* istanbul ignore next */
export function applyQueryFieldsParseOutput<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: QueryFieldsApplyOutput,
    options: QueryFieldsApplyOptions<T> = {},
) {
    if (data.length === 0) {
        return data;
    }

    query.select(data.map((field) => {
        const alias = getAliasForPath(options.relations, field.path) ||
            options.defaultAlias ||
            options.defaultPath;

        return buildKeyWithPrefix(field.key, alias);
    }));

    return data;
}

/**
 * Apply raw fields parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryFields<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryFieldsApplyOptions<T>,
) : QueryFieldsApplyOutput {
    options = options || {};
    if (options.defaultAlias) {
        options.defaultPath = options.defaultAlias;
    }

    return applyQueryFieldsParseOutput(query, parseQueryFields(data, options), options);
}

/**
 * Apply raw fields parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFields<T extends ObjectLiteral = ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: QueryFieldsApplyOptions<T>,
) : QueryFieldsApplyOutput {
    return applyQueryFields(query, data, options);
}
