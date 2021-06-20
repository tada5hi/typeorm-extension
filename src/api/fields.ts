import {SelectQueryBuilder} from "typeorm";
import {hasOwnProperty} from "../utils";
import {changeStringCase, StringCaseOption} from "./utils";

function transformRequestFields(
    raw: unknown,
    allowedFields: Record<string, string[]>,
    options: RequestFieldOptions
): Record<string, string[]> {
    const prototype: string = Object.prototype.toString.call(raw as any);
    if (prototype !== '[object Object]') {
        return {};
    }

    const domains: Record<string, any> = raw as Record<string, any>;
    const result : Record<string, string[]> = {};

    for (const key in domains) {
        if (!domains.hasOwnProperty(key)) {
            continue;
        }

        const domainPrototype : string = Object.prototype.toString.call(domains[key]);

        if (domainPrototype !== '[object Array]' && domainPrototype !== '[object String]') {
            delete domains[key];
            continue;
        }

        let fields : string[] = domainPrototype === '[object String]' ? domains[key].split(',') : domains[key];
        const allowedFieldsKey = hasOwnProperty(options.aliasMapping, key) ?
            options.aliasMapping[key] :
            options.requestDefaultKey;

        fields = fields
            .map(field => changeStringCase(field, options.changeRequestFieldCase))
            .filter(field => allowedFields[allowedFieldsKey].includes(field));

        if(fields.length > 0) {
            result[allowedFieldsKey] = fields;
        }
    }

    return result;
}

function transformAllowedDomainFields(
    data: Record<string, string[]> | string[],
    options: RequestFieldOptions
) {
    let allowedFields : Record<string, string[]> = {};

    if(Array.isArray(data)) {
        allowedFields[options.requestDefaultKey] = data;
    } else {
        allowedFields = data;
    }

    return allowedFields;
}

export type RequestFieldOptions = {
    changeRequestFieldCase?: StringCaseOption | undefined,
    requestDefaultKey: string,
    aliasMapping: Record<string, string>
}

/**
 * Apply fields for specific entity.
 * aliasMapping is a mapping from request domain/entity key to query domain/entity key.
 *
 * @param query
 * @param requestFields
 * @param allowedFields
 * @param partialOptions
 */
export function applyRequestFields(
    query: SelectQueryBuilder<any>,
    requestFields: unknown,
    allowedFields: Record<string, string[]> | string[],
    partialOptions?: Partial<RequestFieldOptions>
) {
    partialOptions = partialOptions ?? {};

    const options : RequestFieldOptions = {
        changeRequestFieldCase: partialOptions.changeRequestFieldCase,
        requestDefaultKey: partialOptions.requestDefaultKey ?? '__DEFAULT__',
        aliasMapping: partialOptions.aliasMapping ?? {}
    }

    allowedFields = transformAllowedDomainFields(allowedFields, options);

    const domains: Record<string, string[]> = transformRequestFields(
        requestFields,
        allowedFields,
        options
    );

    for (const key in domains) {
        if (!domains.hasOwnProperty(key)) continue;

        for(let i=0; i<domains[key].length; i++) {
            query.addSelect((key === options.requestDefaultKey ? '' : key+'.')+domains[key][i]);
        }
    }

    return query;
}

/**
 * Transform allowed fields in array or object representation to object representation.
 *
 * {field1: 'field1', ...} => {field1: 'field1', ...}
 * ['field1', 'field2'] => {field1: 'field1', field2: 'field2'}
 *
 * @param rawFields
 */
export function transformAllowedFields(
    rawFields: string[] | Record<string, string>
): Record<string, string> {
    let fields: Record<string, string> = {};

    const allowedFiltersPrototype: string = Object.prototype.toString.call(rawFields as any);
    switch (allowedFiltersPrototype) {
        case '[object Array]':
            const tempStrArr: string[] = rawFields as string[];
            for (let i = 0; i < tempStrArr.length; i++) {
                fields[tempStrArr[i]] = tempStrArr[i];
            }
            break;
        case '[object Object]':
            fields = (rawFields as Record<string, string>);
            break;
    }

    return fields;
}
