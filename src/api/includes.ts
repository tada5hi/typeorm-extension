import {SelectQueryBuilder} from "typeorm";
import {transformAliasMappingFields} from "./fields";
import {changeStringCase, getDefaultRequestKeyCase, StringCaseOption} from "./utils";

export function transformRequestIncludes(
    raw: unknown,
    aliasMappingIncludes: Record<string, any>,
    options?: RequestIncludeOptions
): string[] {
    options = options ?? {};
    options.changeRequestKeyCase = options.changeRequestKeyCase ?? getDefaultRequestKeyCase();

    let fields: string[] = [];

    const prototype: string = Object.prototype.toString.call(raw);
    if (
        prototype !== '[object Array]' &&
        prototype !== '[object String]'
    ) {
        return [];
    }

    if (prototype === '[object String]') {
        fields = (raw as string).split(',');
    }

    if (prototype === '[object Array]') {
        fields = (raw as any[]).filter(el => typeof el === 'string');
    }

    const result : string[] = [];

    for (let i = 0; i < fields.length; i++) {
        const allowedKey: string = changeStringCase(
            (fields[i] as string).trim() ,
            options.changeRequestKeyCase
        );

        if (allowedKey.length === 0 || !aliasMappingIncludes.hasOwnProperty(allowedKey)) {
            delete fields[i];
        } else {
            result.push(aliasMappingIncludes[allowedKey]);
        }
    }

    return result;
}

export type RequestIncludeOptions = {
    changeRequestKeyCase?: StringCaseOption | undefined
};

export function applyRequestIncludes(
    query: SelectQueryBuilder<any>,
    queryAlias: string,
    include: unknown,
    aliasMappingIncludes: string[] | Record<string, any>,
    partialOptions?: Partial<RequestIncludeOptions>
) {
    partialOptions = partialOptions ?? {};
    const options : RequestIncludeOptions = {
        changeRequestKeyCase: partialOptions.changeRequestKeyCase ?? getDefaultRequestKeyCase()
    };

    const allowedFields: Record<string, string> = transformAliasMappingFields(aliasMappingIncludes, {
        changeRequestKeyCase: options.changeRequestKeyCase
    });
    const requestIncludes: string[] = transformRequestIncludes(
        include,
        allowedFields,
        options
    );

    for (let i=0; i<requestIncludes.length; i++) {
        /* istanbul ignore next */
        query.leftJoinAndSelect(queryAlias + '.' + requestIncludes[i], requestIncludes[i]);
    }

    return requestIncludes;
}
