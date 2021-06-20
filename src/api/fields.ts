import {SelectQueryBuilder} from "typeorm";
import {snakeCase} from "change-case";

function transformRequestFields(raw: unknown, allowedFilters: Record<string, string[]>): Record<string, string[]> {
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

        if (!allowedFilters.hasOwnProperty(key)) {
            continue;
        }

        fields = fields
            .map(field => snakeCase(field))
            .filter(x => allowedFilters[key].includes(x));

        result[key] = fields;
    }

    return result;
}

export function applyRequestFields(
    query: SelectQueryBuilder<any>,
    alias: string,
    fields: unknown,
    allowedFields: Record<string, string[]> | string[]
) {
    const allowed : Record<string, string[]> = {};

    if(Array.isArray(allowedFields)) {
        allowed[alias] = allowedFields.map(allowedField => snakeCase(allowedField));
    } else {
        for(const key in allowedFields) {
            if(!allowedFields.hasOwnProperty(key)) continue;

            allowed[key] = allowedFields[key].map(allowedField => snakeCase(allowedField));
        }
    }

    const domains: Record<string, string[]> = transformRequestFields(fields, allowed);

    for (const key in domains) {
        if (!domains.hasOwnProperty(key)) continue;

        for(let i=0; i<domains[key].length; i++) {
            query.addSelect(key+'.'+domains[key][i]);
        }
    }

    return query;
}
