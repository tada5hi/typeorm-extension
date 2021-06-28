import {Brackets, SelectQueryBuilder} from "typeorm";
import {changeStringCase, getDefaultRequestKeyCase, StringCaseOption} from "./utils";
import {transformAliasMappingFields} from "./fields";

export function transformRequestFilters(
    rawFilters: unknown,
    aliasMappingFields: Record<string, any>,
    options?: RequestFilterOptions
): Record<string, string> {
    options = options ?? {};
    options.changeRequestKeyCase = options.changeRequestKeyCase ?? getDefaultRequestKeyCase();

    let filters: Record<string, any> = {};

    const prototype: string = Object.prototype.toString.call(rawFilters as any);
    /* istanbul ignore next */
    if (prototype !== '[object Object]') {
        return filters;
    }

    filters = rawFilters;

    const result : Record<string, any> = {};

    for (const key in filters) {
        /* istanbul ignore next */
        if (!filters.hasOwnProperty(key)) {
            continue;
        }

        if (
            typeof filters[key] !== 'string' &&
            typeof filters[key] !== 'number' &&
            typeof filters[key] !== 'boolean'
        ) {
            continue;
        }

        let stripped = filters[key];
        if(typeof filters[key] === 'string') {
            stripped = filters[key].replace(',', '').trim();

            if (stripped.length === 0) {
                continue;
            }
        }

        const allowedKey : string = changeStringCase(key, options.changeRequestKeyCase);

        if(!aliasMappingFields.hasOwnProperty(allowedKey)) {
            continue;
        }

        result[aliasMappingFields[allowedKey]] = filters[key];
    }

    return result;
}

export type RequestFilterOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined
};

/**
 * Backwards compatibility.
 */
export function applyRequestFilter(
    query: SelectQueryBuilder<any>,
    rawRequestFilters: unknown,
    aliasMappingFilters: string[] | Record<string, any>,
    partialOptions?: Partial<RequestFilterOptions>
) {
    return applyRequestFilters(
        query,
        rawRequestFilters,
        aliasMappingFilters,
        partialOptions
    );
}

export function applyRequestFilters(
    query: SelectQueryBuilder<any>,
    rawRequestFilters: unknown,
    aliasMappingFilters: string[] | Record<string, any>,
    partialOptions?: Partial<RequestFilterOptions>
) : Record<string, string> {
    partialOptions = partialOptions ?? {};

    const options : RequestFilterOptions = {
        changeRequestKeyCase: partialOptions.changeRequestKeyCase ?? getDefaultRequestKeyCase()
    };

    const allowedFilters: Record<string, string> = transformAliasMappingFields(aliasMappingFilters, {
        changeRequestKeyCase: options.changeRequestKeyCase
    });

    const requestFilters : Record<string, string> = transformRequestFilters(
        rawRequestFilters,
        allowedFilters,
        options
    );

    const requestedFilterLength: number = Object.keys(requestFilters).length;
    if (requestedFilterLength === 0) {
        return requestFilters;
    }

    /* istanbul ignore next */
    query.andWhere(new Brackets(qb => {
        let run = 0;
        for (const key in requestFilters) {
            if (!requestFilters.hasOwnProperty(key)) {
                continue;
            }

            run++;

            let value : string | boolean | number = requestFilters[key];

            const paramKey = 'filter-' + allowedFilters[key] + '-' + run;
            const whereKind : 'where' | 'andWhere' = run === 1 ? 'where' : 'andWhere';

            const queryString : string[] = [
                allowedFilters[key]
            ];

            let isInOperator : boolean = false;

            if(typeof value === 'string') {
                const isUnequalPrefix = value.charAt(0) === '!' && value.charAt(1) === '=';
                if (isUnequalPrefix) value = value.slice(2);

                const isLikeOperator = value.charAt(0) === '~';
                if (isLikeOperator) value = value.slice(1);

                isInOperator = value.includes(',');

                const isEqualOperator = !isLikeOperator && !isInOperator;

                if (isEqualOperator) {
                    if (isUnequalPrefix) {
                        queryString.push("!=");
                    } else {
                        queryString.push("=");
                    }
                } else {
                    if (isUnequalPrefix) {
                        queryString.push('NOT');
                    }

                    if (isLikeOperator) {
                        queryString.push('LIKE');
                    } else {
                        queryString.push('IN');
                    }
                }

                if (isLikeOperator) {
                    value += '%';
                }

                if (isInOperator) {
                    queryString.push('(:' + paramKey + ')');
                } else {
                    queryString.push(':' + paramKey);
                }
            } else {
                isInOperator = false;
                queryString.push("=");
                queryString.push(':' + paramKey);
            }

            qb[whereKind](queryString.join(" "), {[paramKey]: isInOperator ? value.split(',') : value});
        }

        if(run === 0) {
            qb.where("true = true");
        }

        return qb;
    }));

    return requestFilters;
}
