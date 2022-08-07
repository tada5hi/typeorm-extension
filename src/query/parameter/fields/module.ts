import {
    FieldOperator,
    parseQueryFields,
} from 'rapiq';

import { SelectQueryBuilder } from 'typeorm';
import { FieldsApplyOptions, FieldsApplyOutput } from './type';

/**
 * Apply parsed fields parameter data on the db query.
 *
 * @param query
 * @param data
 */
/* istanbul ignore next */
export function applyQueryFieldsParseOutput<T>(
    query: SelectQueryBuilder<T>,
    data: FieldsApplyOutput,
) {
    if (data.length === 0) {
        return data;
    }

    for (let i = 0; i < data.length; i++) {
        const prefix : string = (data[i].alias ? `${data[i].alias}.` : '');
        const key = `${prefix}${data[i].key}`;

        switch (data[i].value) {
            case FieldOperator.INCLUDE:
                query.addSelect(key);
                break;
            case FieldOperator.EXCLUDE:
                // todo: not implemented yet :/
                break;
            default:
                query.select(key);
                break;
        }
    }

    return data;
}

/**
 * Apply raw fields parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQueryFields<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: FieldsApplyOptions,
) : FieldsApplyOutput {
    return applyQueryFieldsParseOutput(query, parseQueryFields(data, options));
}

/**
 * Apply raw fields parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFields<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: FieldsApplyOptions,
) : FieldsApplyOutput {
    return applyQueryFields(query, data, options);
}
