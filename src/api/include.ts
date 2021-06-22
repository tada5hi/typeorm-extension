import {SelectQueryBuilder} from "typeorm";
import {transformAllowedFields} from "./fields";
import {changeStringCase, getDefaultRequestKeyCase, StringCaseOption} from "./utils";

function transformRequestIncludes(
    raw: unknown,
    allowed: Record<string, any>,
    options: RequestIncludeOptions
): string[] {
    let fields: string[] = [];

    const prototype: string = Object.prototype.toString.call(raw);
    if (prototype !== '[object Array]' && prototype !== '[object String]') {
        return [];
    }

    if (prototype === '[object String]') {
        fields = (<string>raw).split(',');
    }

    if (prototype === '[object Array]') {
        fields = (raw as any[]).filter(el => typeof el === 'string');
    }

    const result : string[] = []

    for (let i = 0; i < fields.length; i++) {
        if (typeof fields[i] !== 'string') {
            delete fields[i];
        }

        const allowedKey: string = changeStringCase(
            (fields[i] as string).trim() ,
            options.changeRequestKeyCase
        );

        if (allowedKey.length === 0 || !allowed.hasOwnProperty(allowedKey)) {
            delete fields[i];
        } else {
            result.push(allowed[allowedKey]);
        }
    }

    return result;
}

export type RequestIncludeOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined
}

export function applyRequestIncludes(
    query: SelectQueryBuilder<any>,
    queryAlias: string,
    include: unknown,
    allowedIncludes: string[] | Record<string, any>,
    partialOptions?: Partial<RequestIncludeOptions>
) {
    partialOptions = partialOptions ?? {}
    const options : RequestIncludeOptions = {
        changeRequestKeyCase: partialOptions.changeRequestKeyCase ?? getDefaultRequestKeyCase()
    }

    const allowedFields: Record<string, string> = transformAllowedFields(allowedIncludes);
    const requestIncludes: string[] = transformRequestIncludes(
        include,
        allowedFields,
        options
    );

    for (let i=0; i<requestIncludes.length; i++) {
        query.leftJoinAndSelect(queryAlias + '.' + requestIncludes[i], requestIncludes[i]);
    }

    return query;
}
