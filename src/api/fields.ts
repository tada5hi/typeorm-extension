import {SelectQueryBuilder} from "typeorm";
import {hasOwnProperty} from "../utils";
import {IncludesTransformed} from "./includes";
import {changeStringCase, getDefaultStringCase, StringCaseVariant} from "./utils";

// --------------------------------------------------

export const DEFAULT_ALIAS_ID: string = '__DEFAULT__';

export type FieldsOptions = {
    aliasMapping?: Record<string, string>,
    allowed?: Record<string, string[]> | string[],
    includes?: IncludesTransformed,
    queryAlias?: string,
    /**
     * @deprecated
     */
    stringCase?: StringCaseVariant | undefined,
};

export type AliasFields = {
    addFields?: boolean,
    alias?: string,
    fields: string[]
};

export type FieldsTransformed = AliasFields[];

// --------------------------------------------------

export function buildDomainFields(
    data: Record<string, string[]> | string[],
    options?: FieldsOptions
) {
    options = options ?? {queryAlias: DEFAULT_ALIAS_ID};

    let domainFields : Record<string, string[]> = {};

    if(Array.isArray(data)) {
        domainFields[options.queryAlias] = data;
    } else {
        domainFields = data;
    }

    return domainFields;
}

export function transformFields(
    data: unknown,
    options: FieldsOptions
): FieldsTransformed {
    options ??= {};

    // If it is an empty array nothing is allowed
    if(
        typeof options.allowed !== 'undefined' &&
        Object.keys(options.allowed).length === 0
    ) {
        return [];
    }

    options.aliasMapping ??= {};
    options.includes ??= [];
    options.queryAlias ??= DEFAULT_ALIAS_ID;
    options.stringCase ??= getDefaultStringCase();

    let allowedDomainFields : Record<string, string[]> | undefined;
    if(options.allowed) {
        allowedDomainFields = buildDomainFields(options.allowed, options);
    }

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Object]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return [];
    }

    if(prototype === '[object String]') {
        data = {[options.queryAlias]: data};
    }

    if(prototype === '[object Array]') {
        data = {[options.queryAlias]: data};
    }

    const transformed : FieldsTransformed = [];

    for (const key in (data as Record<string, string[]>)) {
        if (!data.hasOwnProperty(key) || typeof key !== 'string') {
            continue;
        }

        const value : unknown = (data as Record<string, string[]>)[key];

        const valuePrototype : string = Object.prototype.toString.call(value);
        if (
            valuePrototype !== '[object Array]' &&
            valuePrototype !== '[object String]'
        ) {
            continue;
        }

        let fields : string[] = [];

        /* istanbul ignore next */
        if(valuePrototype === '[object String]') {
            fields = (value as string).split(',');
        }

        /* istanbul ignore next */
        if(valuePrototype === '[object Array]') {
            fields = (value as unknown[])
                .filter(val => typeof val === 'string') as string[];
        }

        let fieldsAppend : boolean | undefined;
        for(let i=0; i<fields.length; i++) {
            if(fields[i].substr(0, 1) === '+') {
                fieldsAppend = true;

                fields[i] = fields[i].substr(1);
            }
        }

        if(fields.length === 0) continue;

        const allowedDomains : string[] = typeof allowedDomainFields !== 'undefined' ? Object.keys(allowedDomainFields) : [];
        const targetKey : string = allowedDomains.length === 1 ? allowedDomains[0] : key;

        // is not default domain && includes are defined?
        if(
            key !== DEFAULT_ALIAS_ID &&
            key !== options.queryAlias &&
            typeof options.includes !== 'undefined'
        ) {
            const includesMatched = options.includes.filter(include => include.alias === key);
            if(includesMatched.length === 0) {
                continue;
            }
        }

        fields = fields
            .map(part => {
                part = changeStringCase(part, options.stringCase);

                const fullKey : string = key + '.' + part;

                return options.aliasMapping.hasOwnProperty(fullKey) ? options.aliasMapping[fullKey].split('.').pop() : part;
            })
            .filter(part => {
                if(typeof allowedDomainFields === 'undefined') {
                    return true;
                }

                return hasOwnProperty(allowedDomainFields, targetKey) &&
                    allowedDomainFields[targetKey].indexOf(part) !== -1;
            });

        if(fields.length > 0) {
            const item : AliasFields = {
                fields: fields
            };

            if(targetKey !== DEFAULT_ALIAS_ID) {
                item.alias = targetKey;
            }

            if(typeof fieldsAppend !== 'undefined') {
                item.addFields = fieldsAppend;
            }

            transformed.push(item);
        }
    }

    return transformed;
}

export function applyFieldsTransformed<T>(
    query: SelectQueryBuilder<T>,
    data: FieldsTransformed
) {
    if(data.length === 0) {
        return data;
    }

    for (let i=0; i<data.length; i++) {

        /* istanbul ignore next */
        const prefix : string = data[i].alias ? data[i].alias + '.' : '';

        /* istanbul ignore next */
        data[i].fields.map(item => {
            if(data[i].addFields) {
                query.addSelect(prefix + item);
            } else {
                query.select(prefix + item);
            }
        });
    }

    return data;
}

/**
 * Apply raw field data on query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFields<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: FieldsOptions
) {
    return applyFieldsTransformed(query, transformFields(data, options));
}

// --------------------------------------------------

/**
 * @deprecated
 * @param query
 * @param data
 * @param allowed
 * @param options
 */
export function applyRequestFields(
    query: SelectQueryBuilder<any>,
    data: unknown,
    allowed: Record<string, string[]> | string[],
    options?: FieldsOptions
) {
    return applyFields(query, data, {...options, allowed: allowed});
}

