import {Brackets, SelectQueryBuilder} from "typeorm";
import {snakeCase} from "change-case";
import {IncludesTransformed} from "./includes";
import {buildAliasMapping, buildFieldWithQueryAlias, isFieldAllowedByIncludes} from "./utils";
import {changeStringCase, getDefaultStringCase, StringCaseVariant} from "./utils";
import {FieldDetails, getFieldDetails} from "./utils/field";

// --------------------------------------------------

export type FiltersOptions = {
    aliasMapping?: Record<string, string>,
    allowed?: string[],
    includes?: IncludesTransformed,
    queryAlias?: string,
    /**
     * @deprecated
     */
    stringCase?: StringCaseVariant
};

export type FilterTransformed = {
    type: 'where' | 'andWhere',
    query: string,
    bindings: Record<string, any>
};

export type FiltersTransformed = FilterTransformed[];

// --------------------------------------------------

function buildOptions(options?: FiltersOptions) : FiltersOptions {
    options ??= {};

    if(options.aliasMapping) {
        options.aliasMapping = buildAliasMapping(options.aliasMapping, {
            keyCase: options.stringCase,
            keyDepthCharacter: '.'
        });
    } else {
        options.aliasMapping = {};
    }

    options.includes ??= [];
    options.stringCase ??= getDefaultStringCase();

    return options;
}

export function transformFilters(
    data: unknown,
    options?: FiltersOptions
) : FiltersTransformed {
    options = options ?? {};

    // If it is an empty array nothing is allowed
    if(
        typeof options.allowed !== 'undefined' &&
        Object.keys(options.allowed).length === 0
    ) {
        return [];
    }

    const prototype: string = Object.prototype.toString.call(data);
    /* istanbul ignore next */
    if (prototype !== '[object Object]') {
        return [];
    }

    const length : number = Object.keys(data as Record<string, any>).length;
    if(length === 0) {
        return [];
    }

    options = buildOptions(options);

    const temp : Record<string, string | boolean | number> = {};

    // transform to appreciate data format & validate input
    for (let key in (data as Record<string, any>)) {
        /* istanbul ignore next */
        if (!data.hasOwnProperty(key)) {
            continue;
        }

        let value : unknown = (data as Record<string, any>)[key];

        if (
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean'
        ) {
            continue;
        }

        if(typeof value === 'string') {
            value = (value as string).trim();
            const stripped : string = (value as string).replace('/,/g', '');

            if (stripped.length === 0) {
                continue;
            }
        }

        key = changeStringCase(key, options.stringCase);

        if(options.aliasMapping.hasOwnProperty(key)) {
            key = options.aliasMapping[key];
        }

        const fieldDetails : FieldDetails = getFieldDetails(key);
        if(!isFieldAllowedByIncludes(fieldDetails, options.includes, {queryAlias: options.queryAlias})) {
            continue;
        }

        const keyWithQueryAlias : string = buildFieldWithQueryAlias(fieldDetails, options.queryAlias);

        if(
            typeof options.allowed !== 'undefined' &&
            options.allowed.indexOf(key) === -1 &&
            options.allowed.indexOf(keyWithQueryAlias) === -1
        ) {
            continue;
        }

        temp[keyWithQueryAlias] = value as string | boolean | number;
    }

    const items : FiltersTransformed = [];

    /* istanbul ignore next */
    let run = 0;
    for (const key in temp) {
        /* istanbul ignore next */
        if (!temp.hasOwnProperty(key)) {
            continue;
        }

        run++;

        let value : string | boolean | number = temp[key];

        /* istanbul ignore next */
        const paramKey = 'filter_' + snakeCase(key) + '_' + run;
        const whereKind : FilterTransformed['type'] = run === 1 ? 'where' : 'andWhere';

        const queryString : string[] = [
            key
        ];

        let isInOperator : boolean = false;

        if(typeof value === 'string') {
            const isNegationPrefix = value.charAt(0) === '!';
            if (isNegationPrefix) value = value.slice(1);

            const isLikeOperator = value.charAt(0) === '~';
            if (isLikeOperator) value = value.slice(1);

            isInOperator = value.includes(',');

            if(isInOperator || isLikeOperator) {
                if (isNegationPrefix) {
                    queryString.push('NOT');
                }

                if (isLikeOperator) {
                    queryString.push('LIKE');
                } else {
                    queryString.push('IN');
                }
            } else {
                if (isNegationPrefix) {
                    queryString.push("!=");
                } else {
                    queryString.push("=");
                }
            }

            if (isLikeOperator) {
                value += '%';
            }

            if (isInOperator) {
                queryString.push('(:...' + paramKey + ')');
            } else {
                queryString.push(':' + paramKey);
            }
        } else {
            isInOperator = false;
            queryString.push("=");
            queryString.push(':' + paramKey);
        }

        items.push({
            type: whereKind,
            query: queryString.join(" "),
            bindings: {[paramKey]: isInOperator ? (value as string).split(',') : value}
        });
    }

    return items;
}

export function applyFiltersTransformed<T>(
    query: SelectQueryBuilder<T>,
    data: FiltersTransformed,
) {
    /* istanbul ignore next */
    if(data.length > 0) {
        query.andWhere(new Brackets(qb => {
            for (let i = 0; i < data.length; i++) {
                qb[data[i].type](data[i].query, data[i].bindings);
            }
        }));
    }

    return data;
}

/**
 * Apply raw filter data on query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyFilters<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: FiltersOptions
) : FiltersTransformed {
    return applyFiltersTransformed(query, transformFilters(data, options));
}

// --------------------------------------------------

/**
 * @deprecated
 */
export function applyRequestFilter(
    query: SelectQueryBuilder<any> | undefined,
    data: unknown,
    aliasMapping: Record<string, string>,
    options?: FiltersOptions
) : FiltersTransformed  {
    return applyRequestFilters(
        query,
        data,
        aliasMapping,
        options
    );
}

/**
 * @deprecated
 * @param query
 * @param data
 * @param aliasMapping
 * @param options
 */
export function applyRequestFilters(
    query: SelectQueryBuilder<any> | undefined,
    data: unknown,
    aliasMapping: Record<string, string>,
    options?: Partial<FiltersOptions>
) : FiltersTransformed {
    return applyFiltersTransformed(query, transformFilters(
        data,
        {...options, aliasMapping: aliasMapping}
    ));
}
