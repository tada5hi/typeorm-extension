import {Brackets, SelectQueryBuilder} from "typeorm";
import {snakeCase} from 'change-case';

function transformRequestFilters(
    rawFilters: unknown,
    allowedFilters: Record<string, any>
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

        const newKey : string = snakeCase(key);

        if(!allowedFilters.hasOwnProperty(newKey)) {
            continue;
        }

        result[newKey] = filters[key];
    }

    return result;
}

export function transformAllowedFilters(
    rawFields: string[] | Record<string, any>
): Record<string, string> {
    const fields: Record<string, string> = {};

    const allowedFiltersPrototype: string = Object.prototype.toString.call(rawFields as any);
    switch (allowedFiltersPrototype) {
        case '[object Array]':
            const tempStrArr : string[] = rawFields as string[];
            for (let i = 0; i < tempStrArr.length; i++) {
                const newKey : string = snakeCase(tempStrArr[i]);
                fields[newKey] = newKey;
            }
            break;
        case '[object Object]':
            rawFields = (rawFields as Record<string, any>);
            for(const key in rawFields) {
                if(!rawFields.hasOwnProperty(key)) continue;

                const newKey : string = snakeCase(key);

                fields[newKey] = rawFields[key];
            }
            break;
    }

    return fields;
}

export function applyRequestFilter(
    query: SelectQueryBuilder<any>,
    rawRequestFilters: unknown,
    rawAllowedFilters: string[] | Record<string, any>
) {
    const allowedFilters: Record<string, any> = transformAllowedFilters(rawAllowedFilters);
    const requestFilters : Record<string, any> = transformRequestFilters(rawRequestFilters, allowedFilters);

    const requestedFilterLength: number = Object.keys(requestFilters).length;
    if (requestedFilterLength === 0) {
        return query;
    }

    return query.andWhere(new Brackets(qb => {
        let run = 0;
        for (const key in requestFilters) {
            if (!requestFilters.hasOwnProperty(key) || !allowedFilters.hasOwnProperty(key)) {
                continue;
            }

            run++;

            let value : string = requestFilters[key];

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
