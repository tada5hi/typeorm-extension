import {SelectQueryBuilder} from "typeorm";
import {buildAliasMapping} from "./utils";
import {changeStringCase, getDefaultStringCase, StringCaseVariant} from "./utils";

// --------------------------------------------------

export type RequestSortOptions = {
    aliasMapping?: Record<string, string>,
    allowed?: string[],
    queryAlias?: string,
    stringCase?: StringCaseVariant
};

export type SortDirection = 'ASC' | 'DESC';
export type SortTransformed = Record<string, SortDirection>;

// --------------------------------------------------

/**
 * Tranform sort data to appreciate data format.
 * @param data
 * @param options
 */
export function transformSort(
    data: unknown,
    options?: RequestSortOptions
) : SortTransformed {
    options = options ?? {};

    // If it is an empty array nothing is allowed
    if(
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return {};
    }

    options.aliasMapping = options.aliasMapping ? buildAliasMapping(options.aliasMapping) : {};
    options.stringCase = options.stringCase ?? getDefaultStringCase();

    const items : SortTransformed = {};

    const prototype = Object.prototype.toString.call(data);

    /* istanbul ignore next */
    if(
        prototype !== '[object String]' &&
        prototype !== '[object Array]' &&
        prototype !== '[object Object]'
    ) {
        return items;
    }

    let parts : string[] = [];

    if(prototype === '[object String]') {
        parts = (data as string).split(',');
    }

    if(prototype === '[object Array]') {
        parts = (data as any[]).filter(item => typeof item === 'string');
    }

    if(prototype === '[object Object]') {
        const ob : Record<string, any> = data as object;
        for(const key in ob) {
            /* istanbul ignore next */
            if (
                typeof key !== 'string' ||
                typeof ob[key] !== 'string' ||
                !ob.hasOwnProperty(key)
            ) continue;

            const fieldPrefix = ob[key].toLowerCase() === 'desc' ? '-' : '';

            parts.push(fieldPrefix + key);
        }
    }

    for(let i=0; i<parts.length; i++) {
        let direction: SortDirection = 'ASC';
        if (parts[i].substr(0, 1) === '-') {
            direction = 'DESC';
            parts[i] = parts[i].substr(1);
        }

        let key: string = changeStringCase(parts[i], options.stringCase);

        if (options.aliasMapping.hasOwnProperty(key)) {
            key = options.aliasMapping[key];
        }

        if(
            typeof options.allowed !== 'undefined' &&
            options.allowed.indexOf(key) === -1
        ) {
            continue;
        }

        if(options.queryAlias) {
            key = options.queryAlias + '.' + key;
        }

        items[key] = direction;
    }

    return items;
}

export function applySortTransformed<T>(query: SelectQueryBuilder<T>, sort: SortTransformed) {
    return query.orderBy(sort);
}

/**
 * Apply raw sort data on query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applySort<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: RequestSortOptions
) : SelectQueryBuilder<T> {
    return applySortTransformed(query, transformSort(data, options));
}


