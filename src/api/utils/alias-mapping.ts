import {changeStringCase, getDefaultStringCase, StringCaseVariant} from "./string-case";

export type AliasMappingOptions = {
    keyCase?: StringCaseVariant,
    keyDepthCharacter?: string
};

/**
 * Build alias mapping from strings in array or object representation to object representation.
 *
 * {field1: 'field1', ...} => {field1: 'field1', ...}
 * ['field1', 'field2'] => {field1: 'field1', field2: 'field2'}
 *
 * @param rawFields
 * @param options
 */
export function buildAliasMapping(
    rawFields: string[] | Record<string, string>,
    options?: AliasMappingOptions
): Record<string, string> {
    options = options ?? {};
    options = {
        keyCase: options.keyCase ?? getDefaultStringCase(),
        keyDepthCharacter: options.keyDepthCharacter
    };

    const fields: Record<string, string> = {};

    const allowedFiltersPrototype: string = Object.prototype.toString.call(rawFields as any);
    switch (allowedFiltersPrototype) {
        case '[object Array]':
            const tempStrArr: string[] = rawFields as string[];
            for (let i = 0; i < tempStrArr.length; i++) {
                const key: string = changeStringCase(tempStrArr[i], options.keyCase, {depthCharacter: options.keyDepthCharacter});
                fields[key] = tempStrArr[i];
            }
            break;
        case '[object Object]':
            const temp: Record<string, any> = (rawFields as Record<string, string>);
            for (const tempKey in temp) {
                const key: string = changeStringCase(tempKey, options.keyCase, {depthCharacter: options.keyDepthCharacter});

                fields[key] = temp[tempKey];
            }
            break;
    }

    return fields;
}
