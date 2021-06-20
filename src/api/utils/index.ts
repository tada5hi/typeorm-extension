import {camelCase, snakeCase, pascalCase, capitalCase} from 'change-case';

export type StringCaseOption = 'camelCase' | 'snakeCase' | 'pascalCase' | 'capitalCase';

export function changeStringCase(
    str: string,
    strCase?: StringCaseOption
) {
    if(typeof strCase === 'undefined') {
        return str;
    }

    switch (strCase) {
        case "camelCase":
            return camelCase(str);
        case "snakeCase":
            return snakeCase(str);
        case "pascalCase":
            return pascalCase(str);
        case "capitalCase":
            return capitalCase(str);
    }
}
