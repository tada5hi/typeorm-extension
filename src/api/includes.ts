import {SelectQueryBuilder} from "typeorm";
import minimatch from 'minimatch';

import {
    buildAliasMapping,
    changeStringCase,
    getDefaultStringCase,
    StringCaseVariant
} from "./utils";

// --------------------------------------------------

export type IncludeTransformed = {
    property: string,
    alias: string
};
export type IncludesTransformed = IncludeTransformed[];

export type IncludesOptions = {
    aliasMapping?: Record<string, string>,
    allowed?: string[],
    queryAlias?: string,
    stringCase?: StringCaseVariant,
    includeParents?: boolean | string[] | string
};

// --------------------------------------------------

function includeParents(
    data: string[],
    options: IncludesOptions
) : string[] {
    const ret : string[] = [];

    for(let i=0; i<data.length; i++) {
        const parts: string[] = data[i].split('.');

        let value: string = changeStringCase(parts.shift(), options.stringCase);
        /* istanbul ignore next */
        if (options.aliasMapping.hasOwnProperty(value)) {
            value = options.aliasMapping[value];
        }

        if(ret.indexOf(value) === -1) {
            ret.push(value);
        }

        while (parts.length > 0) {
            const postValue: string = changeStringCase(parts.shift(), options.stringCase);
            value += '.' + postValue;
            /* istanbul ignore next */
            if (options.aliasMapping.hasOwnProperty(value)) {
                value = options.aliasMapping[value];
            }

            if(ret.indexOf(value) === -1) {
                ret.push(value);
            }
        }
    }

    return ret;
}

export function transformIncludes(
    data: unknown,
    options?: IncludesOptions
): IncludesTransformed {
    options ??= {};

    // If it is an empty array nothing is allowed
    if(
        Array.isArray(options.allowed) &&
        options.allowed.length === 0
    ) {
        return [];
    }

    if(options.aliasMapping) {
        options.aliasMapping = buildAliasMapping(options.aliasMapping, {
            keyCase: options.stringCase,
            keyDepthCharacter: '.'
        });
    } else {
        options.aliasMapping = {};
    }

    if(options.allowed) {
        options.allowed = includeParents(options.allowed, {aliasMapping: {}, stringCase: options.stringCase});
    }

    options.stringCase ??= getDefaultStringCase();
    options.includeParents ??= true;

    let items: string[] = [];

    const prototype: string = Object.prototype.toString.call(data);
    if (
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return [];
    }

    if (prototype === '[object String]') {
        items = (data as string).split(',');
    }

    if (prototype === '[object Array]') {
        items = (data as any[]).filter(el => typeof el === 'string');
    }

    if(items.length === 0) {
        return [];
    }

    items = items
        .map(item => {
            item = changeStringCase(item, options.stringCase, {depthCharacter: '.'});

            if (options.aliasMapping.hasOwnProperty(item)) {
                item = options.aliasMapping[item];
            }

            return item;
        })
        .filter(item => typeof options.allowed === 'undefined' || options.allowed.indexOf(item) !== -1);

    if(options.includeParents) {
        if(Array.isArray(options.includeParents)) {
            const parentIncludes = items.filter(item => item.includes('.') && (options.includeParents as string[]).filter(parent => minimatch(item, parent)).length > 0);
            items.unshift(...includeParents(parentIncludes, options));
        } else {
            items = includeParents(items, options);
        }
    }

    items = Array.from(new Set(items));

    return items
        .map(relation => {
            return {
                property: relation.includes('.') ? relation : (options.queryAlias ? options.queryAlias + '.' + relation : relation),
                alias: relation.split('.').pop()
            };
        });
}

export function applyIncludesTransformed<T>(
    query: SelectQueryBuilder<T>,
    data: IncludesTransformed
) : IncludesTransformed {
    for (let i=0; i<data.length; i++) {
        /* istanbul ignore next */
        query.leftJoinAndSelect(data[i].property, data[i].alias);
    }

    return data;
}

/**
 * Apply raw include data on query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyIncludes<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: IncludesOptions
) : IncludesTransformed {
    return applyIncludesTransformed(query, transformIncludes(data, options));
}

// --------------------------------------------------

/**
 * @deprecated
 * @param query
 * @param data
 * @param allowed
 * @param options
 */
export function applyRequestIncludes(
    query: SelectQueryBuilder<any>,
    data: unknown,
    allowed: string[],
    options?: IncludesOptions
) : IncludesTransformed {
    return applyIncludes(query, data, {...options, allowed: allowed});
}
