import {parseQuerySort, SortDirection, SortParseOutput, SortParseOptions} from "@trapi/query";
import {SelectQueryBuilder} from "typeorm";

// --------------------------------------------------

/**
 * Apply parsed sort parameter data on the db query.
 *
 * @param query
 * @param data
 */
export function applyParsedQuerySort<T>(
    query: SelectQueryBuilder<T>,
    data: SortParseOutput
) : SortParseOutput {
    if(data.length === 0) {
        return data;
    }

    const sort : Record<string, SortDirection> = {};

    for(let i=0; i<data.length; i++) {
        const prefix : string = data[i].alias ? data[i].alias + '.' : '';
        const key : string = `${prefix}${data[i].key}`;

        sort[key] = data[i].value;
    }

    query.orderBy(sort);

    return data;
}

/**
 * Apply raw sort parameter data on the db query.
 *
 * @param query
 * @param data
 * @param options
 */
export function applyQuerySort<T>(
    query: SelectQueryBuilder<T>,
    data: unknown,
    options?: SortParseOptions
) : SortParseOutput {
    return applyParsedQuerySort(query, parseQuerySort(data, options));
}


