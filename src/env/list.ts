import { read } from 'envix';

/**
 * Split a comma separated list of glob patterns. A comma inside a brace
 * group (`*{.ts,.js}`, nested groups included) belongs to its pattern and
 * does not split. Entries are trimmed, empty ones dropped.
 */
export function splitEnvList(input: string) : string[] {
    const output : string[] = [];

    let depth = 0;
    let start = 0;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
            output.push(input.slice(start, i));
            start = i + 1;
        }
    }

    output.push(input.slice(start));

    return output
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

/**
 * Read a comma separated list of glob patterns, see splitEnvList().
 * Undefined when the variable is unset.
 */
export function readEnvList(key: string) : string[] | undefined {
    const value = read(key);

    if (typeof value === 'undefined') {
        return undefined;
    }

    return splitEnvList(value);
}
