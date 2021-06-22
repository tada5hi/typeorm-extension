import {Brackets, SelectQueryBuilder} from "typeorm";
import {changeStringCase, getDefaultRequestKeyCase, StringCaseOption} from "./utils";
import {transformAllowedFields} from "./fields";

function transformRequestFilters(
    rawFilters: unknown,
    allowedFilters: Record<string, any>,
    options: RequestFilterOptions
): Record<string, string> {
    let filters: Record<string, any> = {};

    const prototype: string = Object.prototype.toString.call(rawFilters as any);
    if (prototype !== '[object Object]') {
        return filters;
    }

    filters = rawFilters;

    const result : Record<string, any> = {};

    for (const key in filters) {
        if (!filters.hasOwnProperty(key)) {
            continue;
        }

        if (typeof filters[key] !== 'string') {
            continue;
        }

        const stripped = filters[key].replace(',', '').trim();

        if (stripped.length === 0) {
            continue;
        }

        const allowedKey : string = changeStringCase(key, options.changeRequestKeyCase);

        if(!allowedFilters.hasOwnProperty(allowedKey)) {
            continue;
        }

        result[allowedFilters[allowedKey]] = filters[key];
    }

    return result;
}

export type RequestFilterOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined
}

export function applyRequestFilter(
    query: SelectQueryBuilder<any>,
    requestFilters: unknown,
    rawAllowedFilters: string[] | Record<string, any>,
    partialOptions?: Partial<RequestFilterOptions>
) {
    partialOptions = partialOptions ?? {};

    const options : RequestFilterOptions = {
        changeRequestKeyCase: partialOptions.changeRequestKeyCase ?? getDefaultRequestKeyCase()
    };

    const allowedFilters: Record<string, string> = transformAllowedFields(rawAllowedFilters);
    const filters : Record<string, string> = transformRequestFilters(
        requestFilters,
        allowedFilters,
        options
    );

    const requestedFilterLength: number = Object.keys(filters).length;
    if (requestedFilterLength === 0) {
        return query;
    }

    return query.andWhere(new Brackets(qb => {
        let run = 0;
        for (const key in filters) {
            if (!filters.hasOwnProperty(key) || !allowedFilters.hasOwnProperty(key)) {
                continue;
            }

            run++;

            let value : string = filters[key];

            const paramKey = 'filter-' + allowedFilters[key] + '-' + run;
            const whereKind : 'where' | 'andWhere' = run === 1 ? 'where' : 'andWhere';

            const queryString : string[] = [
                allowedFilters[key]
            ];

            const isUnequalPrefix = value.charAt(0) === '!' && value.charAt(1) === '=';
            if(isUnequalPrefix) value = value.slice(2);

            const isLikeOperator = value.charAt(0) === '~';
            if(isLikeOperator) value = value.slice(1);

            const isInOperator = value.includes(',');

            const isEqualOperator = !isLikeOperator && !isInOperator;

            if(isEqualOperator) {
                if(isUnequalPrefix) {
                    queryString.push("!=");
                } else {
                    queryString.push("=");
                }
            } else {
                if(isUnequalPrefix) {
                    queryString.push('NOT');
                }

                if(isLikeOperator) {
                    queryString.push('LIKE');
                } else {
                    queryString.push('IN');
                }
            }

            if(isLikeOperator) {
                value += '%';
            }

            if(isInOperator) {
                queryString.push('(:'+paramKey+')');
            } else {
                queryString.push(':'+paramKey);
            }

            qb[whereKind](queryString.join(" "), {[paramKey]: isInOperator ? value.split(',') : value});
        }

        if(run === 0) {
            qb.where("true = true");
        }

        return qb;
    }));
}
