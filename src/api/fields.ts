import {FieldOperator, FieldsParsed, FieldsParseOptions, parseFields} from "@trapi/query";
import {SelectQueryBuilder} from "typeorm";

/**
 * Apply parsed fields parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyParsedQueryFields<T>(
    query: SelectQueryBuilder<T>,
    data: FieldsParsed
) {
    if(data.length === 0) {
        return data;
    }

    for (let i=0; i<data.length; i++) {
        /* istanbul ignore next */
        const prefix : string = (data[i].alias ? data[i].alias + '.' : '');
        const key : string = `${prefix}${data[i].key}`;

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
    options?: FieldsParseOptions
) : FieldsParsed {
    return applyParsedQueryFields(query, parseFields(data, options));
}

