import type { EnvixKey } from 'envix';
import { read } from 'envix';

/**
 * Find the end of a glob character class starting at index (the "[").
 * A "]" directly after "[", "[!" or "[^" is a literal member, and a
 * POSIX class ("[:alpha:]") is skipped as a whole.
 * Returns -1 for an unclosed class, which is then a literal "[".
 */
function findCharacterClassEnd(input: string, index: number) : number {
    let i = index + 1;

    if (input[i] === '!' || input[i] === '^') {
        i++;
    }

    if (input[i] === ']') {
        i++;
    }

    for (; i < input.length; i++) {
        if (input[i] === '\\') {
            i++;
        } else if (input[i] === '[' && input[i + 1] === ':') {
            // a POSIX class ([:alpha:]) holds a "]" of its own
            const end = input.indexOf(':]', i + 2);

            if (end !== -1) {
                i = end + 1;
            }
        } else if (input[i] === ']') {
            return i;
        }
    }

    return -1;
}

/**
 * Split a comma separated list of glob patterns. A comma inside a brace
 * group (`*{.ts,.js}`, nested groups included) or a character class
 * (`[,]`) belongs to its pattern and does not split. Escaped characters
 * (`\{`, `\,`) and braces inside a character class do not open or close
 * a group. Entries are trimmed, empty ones dropped; escapes are kept.
 */
export function splitEnvList(input: string) : string[] {
    const output : string[] = [];

    let depth = 0;
    let start = 0;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === '\\') {
            i++;
        } else if (char === '[') {
            const end = findCharacterClassEnd(input, i);

            if (end !== -1) {
                i = end;
            }
        } else if (char === '{') {
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
 * With a list of keys, the first set key wins.
 * Undefined when no key is set.
 */
export function readEnvList(key: EnvixKey) : string[] | undefined {
    const value = read(key);

    if (typeof value === 'undefined') {
        return undefined;
    }

    return splitEnvList(value);
}
