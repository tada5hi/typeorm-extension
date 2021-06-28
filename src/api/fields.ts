import {SelectQueryBuilder} from "typeorm";
import {hasOwnProperty} from "../utils";
import {changeStringCase, getDefaultRequestKeyCase, StringCaseOption} from "./utils";

export const ALTERNATIVE_DEFAULT_DOMAIN_KEY: string = '__DEFAULT';

export function transformRequestFields(
    raw: unknown,
    allowedFields: Record<string, string[]>,
    options: RequestFieldOptions
): Record<string, string[]> {
    options = options ?? {};
    options.aliasMapping = options.aliasMapping ?? {};
    options.requestDefaultKey = options.requestDefaultKey ?? ALTERNATIVE_DEFAULT_DOMAIN_KEY;
    options.changeRequestKeyCase = options.changeRequestKeyCase ?? getDefaultRequestKeyCase();

    const prototype: string = Object.prototype.toString.call(raw as any);
    if (
        prototype !== '[object Object]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return {};
    }

    if(prototype === '[object String]') {
        raw = {[options.requestDefaultKey]: (raw as string).split(',')};
    }

    if(prototype === '[object Array]') {
        raw = {[options.requestDefaultKey]: raw};
    }

    const domains: Record<string, any> = raw as Record<string, any>;
    const result : Record<string, string[]> = {};

    const allowedFieldsKeys : string[] = Object.keys(allowedFields);

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
        let allowedFieldsKey = hasOwnProperty(options.aliasMapping, key) ?
            options.aliasMapping[key] :
            options.requestDefaultKey;


        if(
            allowedFieldsKey === options.requestDefaultKey &&
            allowedFieldsKeys.length === 1
        ) {
            allowedFieldsKey = allowedFieldsKeys[0];
        }

        fields = fields
            .map(field => changeStringCase(field, options.changeRequestKeyCase))
            .filter(field => hasOwnProperty(allowedFields, allowedFieldsKey) && allowedFields[allowedFieldsKey].includes(field));

        if(fields.length > 0) {
            result[allowedFieldsKey] = fields;
        }
    }

    return result;
}

export function transformAllowedDomainFields(
    data: Record<string, string[]> | string[],
    options?: RequestFieldOptions
) {
    options = options ?? {
        requestDefaultKey: ALTERNATIVE_DEFAULT_DOMAIN_KEY
    };

    let allowedFields : Record<string, string[]> = {};

    if(Array.isArray(data)) {
        allowedFields[options.requestDefaultKey] = data;
    } else {
        allowedFields = data;
    }

    return allowedFields;
}

export type RequestFieldOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined,
    aliasMapping?: Record<string, string>
    requestDefaultKey?: string,
};

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
        changeRequestKeyCase: partialOptions.changeRequestKeyCase ?? getDefaultRequestKeyCase(),
        requestDefaultKey: partialOptions.requestDefaultKey ?? ALTERNATIVE_DEFAULT_DOMAIN_KEY,
        aliasMapping: partialOptions.aliasMapping ?? {}
    };

    allowedFields = transformAllowedDomainFields(allowedFields, options);

    const domains: Record<string, string[]> = transformRequestFields(
        requestFields,
        allowedFields,
        options
    );

    for (const key in domains) {
        if (!domains.hasOwnProperty(key)) continue;

        for(let i=0; i<domains[key].length; i++) {
            /* istanbul ignore next */
            query.addSelect((key === options.requestDefaultKey ? '' : key+'.')+domains[key][i]);
        }
    }

    return domains;
}

export type AliasMappingFieldsOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined
};
/**
 * Transform alias mapping fields in array or object representation to object representation.
 *
 * {field1: 'field1', ...} => {field1: 'field1', ...}
 * ['field1', 'field2'] => {field1: 'field1', field2: 'field2'}
 *
 * @param rawFields
 * @param options
 */
export function transformAliasMappingFields(
    rawFields: string[] | Record<string, string>,
    options?: AliasMappingFieldsOptions
): Record<string, string> {
    options = options ?? {};
    options = {
        changeRequestKeyCase: options.changeRequestKeyCase ?? getDefaultRequestKeyCase()
    };

    const fields: Record<string, string> = {};

    const allowedFiltersPrototype: string = Object.prototype.toString.call(rawFields as any);
    switch (allowedFiltersPrototype) {
        case '[object Array]':
            const tempStrArr: string[] = rawFields as string[];
            for (let i = 0; i < tempStrArr.length; i++) {
                const key : string = changeStringCase(tempStrArr[i], options.changeRequestKeyCase);
                fields[key] = tempStrArr[i];
            }
            break;
        case '[object Object]':
            const temp : Record<string, any> = (rawFields as Record<string, string>);
            for(const tempKey in temp) {
                const key : string = changeStringCase(tempKey, options.changeRequestKeyCase);

                fields[key] = temp[tempKey];
            }
            break;
    }

    return fields;
}
