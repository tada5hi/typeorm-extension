import {SelectQueryBuilder} from "typeorm";
import {transformAllowedFilters} from "./filter";

function transformRequestFields(raw: unknown, allowed: Record<string, any>): Record<string, string> {
    let fields: unknown[] = [];

    const prototype: string = Object.prototype.toString.call(raw);
    if (prototype !== '[object Array]' && prototype !== '[object String]') {
        return {};
    }

    if (prototype === '[object String]') {
        fields = (<string>raw).split(',');
    }

    if (prototype === '[object Array]') {
        fields = <string[]>raw;
    }

    const result: Record<string, string> = {};

    for (let i = 0; i < fields.length; i++) {
        if (typeof fields[i] !== 'string') {
            delete fields[i];
        }

        const stripped: string = (<string>fields[i]).trim();

        if (stripped.length === 0 || !allowed.hasOwnProperty(stripped)) {
            delete fields[i];
        } else {
            result[stripped] = allowed[stripped];
        }
    }

    return result;
}

export function applyRequestIncludes(query: SelectQueryBuilder<any>, alias: string, include: unknown, allowedIncludes: string[] | Record<string, any>) {
    const allowedFields: Record<string, any> = transformAllowedFilters(allowedIncludes);
    const requestIncludes: Record<string, string> = transformRequestFields(include, allowedFields);

    for (const key in requestIncludes) {
        if (!requestIncludes.hasOwnProperty(key)) continue;

        query.leftJoinAndSelect(alias + '.' + requestIncludes[key], requestIncludes[key]);
    }

    return query;
}
