import { hasOwnProperty } from '../../utils';

export function isQueryOptionDefined(
    input: Record<string, any> | boolean,
    option: string | string[],
) {
    if (typeof input === 'boolean') {
        return false;
    }

    const options = Array.isArray(option) ? option : [option];

    for (let i = 0; i < options.length; i++) {
        if (hasOwnProperty(input, options[i])) {
            return true;
        }
    }

    return false;
}
