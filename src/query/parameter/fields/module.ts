import {
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
    extendSelection?: boolean,
) {
    if (data.length === 0) {
        return data;
    }

    if (extendSelection) {
        query.addSelect(data.map((field) => {
            const prefix : string = (field.alias ? `${field.alias}.` : '');
            return `${prefix}${field.key}`;
        }));
    } else {
        query.select(data.map((field) => {
            const prefix : string = (field.alias ? `${field.alias}.` : '');
            return `${prefix}${field.key}`;
        }));
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
