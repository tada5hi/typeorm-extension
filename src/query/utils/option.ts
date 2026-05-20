import { hasOwnProperty } from '../../utils';

export function isQueryOptionDefined(
    input: Record<string, any> | boolean,
    option: string | string[],
) {
    if (typeof input === 'boolean') {
        return false;
    }

    const options = Array.isArray(option) ? option : [option];

    for (const option_ of options) {
        if (hasOwnProperty(input, option_)) {
            return true;
        }
    }

    return false;
}
