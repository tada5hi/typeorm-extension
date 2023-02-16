import type { DataSourceOptions } from 'typeorm';
import type { SeederOptions } from '../../seeder';
import {
    hasOwnProperty,
    isTsNodeRuntimeEnvironment,
    withoutTrailingSlash,
} from '../../utils';
import { readTsConfig } from '../../utils/tsconfig';

const stripLeadingModifier = (text: string) => {
    if (text.startsWith('./')) {
        text = text.substring(2);
    }

    return text;
};

export function safeReplaceWindowsSeparator(input: string) {
    if (
        input.indexOf('*') !== -1 ||
        input.indexOf('**') !== -1 ||
        input.indexOf('{') !== -1
    ) {
        return input;
    }

    return input.replace(/\\/g, '/');
}

export function changeTSToJSPath(
    input: string,
    dist?: string,
    src?: string,
) : string {
    let base = input;
    let baseIndex = input.lastIndexOf('/');
    if (baseIndex !== -1) {
        base = base.substring(baseIndex + 1);
    }

    if (src) {
        src = withoutTrailingSlash(
            stripLeadingModifier(
                safeReplaceWindowsSeparator(src),
            ),
        );
    }
    src = src || 'src';

    if (dist) {
        dist = withoutTrailingSlash(
            stripLeadingModifier(
                safeReplaceWindowsSeparator(
                    dist,
                ),
            ),
        );
    }
    dist = dist || 'dist';

    if (
        input.indexOf(src) !== -1 &&
        input.indexOf(dist) === -1
    ) {
        const lastIndex = input.lastIndexOf(src);
        const prevCharacter = input.substring(lastIndex - 1, lastIndex);
        if (!prevCharacter || prevCharacter === '/') {
            input = input.substring(0, lastIndex) +
                dist +
                input.substring(lastIndex + src.length);

            baseIndex = input.lastIndexOf('/');
        }
    }

    // if the path already contains a js file extension, we are done
    const jsExtensions = ['js', 'cjs', 'mjs'];
    for (let i = 0; i < jsExtensions.length; i++) {
        if (base.indexOf(jsExtensions[i]) !== -1) {
            return input;
        }
    }

    const tsExtensions = ['ts', 'cts', 'mts'];
    for (let i = 0; i < tsExtensions.length; i++) {
        const regex = new RegExp(`(\\.${tsExtensions[i]}|${tsExtensions[i]})`, 'g');
        let matchesSum : number | undefined;
        const matches = base.match(regex);
        if (Array.isArray(matches)) {
            matchesSum = matches.length;
        }

        let matchesCounter = 0;

        const bracketIndex = base.lastIndexOf('{');
        base = base.replace(
            regex,
            (...args) => {
                matchesCounter++;

                // if the file extension name comes after the last bracket index,
                // we can be pretty sure that the extension name is not part of a filename
                if (
                    (args[2] >= bracketIndex && bracketIndex !== -1) ||
                    (bracketIndex === -1 && matchesCounter === matchesSum)
                ) {
                    return args[0].startsWith('.') ? `.${jsExtensions[i]}` : jsExtensions[i];
                }

                return args[0];
            },
        );
    }

    if (baseIndex !== -1) {
        base = input.substring(0, baseIndex + 1) + base;
    }

    return stripLeadingModifier(base);
}

const keys = [
    'entities',
    'migrations',
    'seeds',
    'factories',
    'subscribers',
];

export async function modifyDataSourceOptionsForRuntimeEnvironment<T extends Partial<DataSourceOptions> & SeederOptions>(
    input: T,
    options?: {
        root?: string,
        keys?: string[]
    },
) : Promise<T> {
    if (isTsNodeRuntimeEnvironment()) {
        return input;
    }

    options = options || {};

    const { compilerOptions } = await readTsConfig(options.root);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as keyof T;

        if (
            !hasOwnProperty(input, key) ||
            (options.keys && options.keys.indexOf(key as string) === -1)
        ) {
            continue;
        }

        let value = input[key] as unknown;
        if (typeof value === 'string') {
            value = changeTSToJSPath(value, compilerOptions?.outDir);
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] === 'string') {
                    value[i] = changeTSToJSPath(value[i], compilerOptions?.outDir);
                }
            }
        }

        input[key] = value as T[keyof T];
    }

    return input;
}
