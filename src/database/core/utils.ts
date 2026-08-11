import { hasOwnProperty, isObject  } from '../../utils';

export function hasResultRows(input: unknown): boolean {
    return isObject(input) &&
        hasOwnProperty(input, 'rows') &&
        Array.isArray(input.rows) &&
        input.rows.length > 0;
}
