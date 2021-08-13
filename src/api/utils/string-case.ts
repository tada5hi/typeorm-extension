import {camelCase, capitalCase, pascalCase, snakeCase} from "change-case";

export type StringCaseVariant = 'camelCase' | 'snakeCase' | 'pascalCase' | 'capitalCase';
export type StringCaseOptions = {
    depthCharacter?: string
};

export function changeStringCase(
    str: string,
    variant?: StringCaseVariant,
    options?: StringCaseOptions
) {
    if (typeof variant === 'undefined') {
        return str;
    }

    options = options ?? {};

    if(typeof options.depthCharacter === 'string') {
        let parts : string[] = str.split(options.depthCharacter);

        parts = parts.map(part => changeStringCase(part, variant));

        return parts.join(options.depthCharacter);
    }

    switch (variant) {
        case "camelCase":
            return camelCase(str);
        case "snakeCase":
            return snakeCase(str);
        case "pascalCase":
            return pascalCase(str);
        case "capitalCase":
            return capitalCase(str);
    }

    return str;
}

let stringCase: StringCaseVariant | undefined;

/**
 * @deprecated
 * @param variant
 */
export function setDefaultStringCase(variant?: StringCaseVariant) {
    stringCase = variant;
}

/**
 * @deprecated
 */
export function getDefaultStringCase(): StringCaseVariant | undefined {
    return stringCase;
}

// --------------------------------------------------
/**
 * Use getDefaultStringCase instead.
 *
 * @deprecated
 * @param variant
 */
export function setDefaultRequestKeyCase(variant?: StringCaseVariant) {
    stringCase = variant;
}

/**
 * Use setDefaultStringCase instead.
 *
 * @deprecated
 */
export function getDefaultRequestKeyCase(): StringCaseVariant | undefined {
    return stringCase;
}
