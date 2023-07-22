import { isObject } from 'locter';
import path from 'node:path';
import { CodeTransformation, isCodeTransformation } from './code-transformation';
import { canReplaceWindowsSeparator, replaceWindowSeparator } from './separator';
import { withoutTrailingSlash } from './slash';
import type { TSConfig } from './tsconfig';
import { readTSConfig } from './tsconfig';

const stripLeadingModifier = (text: string) => {
    if (text.startsWith('./')) {
        text = text.substring(2);
    }

    return text;
};

export function transformFilePath(
    input: string,
    dist?: string,
    src?: string,
): string {
    let separator = path.sep;
    const windowsSeparatorReplaceable = canReplaceWindowsSeparator(input);
    if (windowsSeparatorReplaceable) {
        separator = '/';
        input = replaceWindowSeparator(input);
    }

    let base = input;
    let baseIndex = input.lastIndexOf(separator);
    if (baseIndex !== -1) {
        base = base.substring(baseIndex + 1);
    }

    if (src) {
        if (windowsSeparatorReplaceable) {
            src = replaceWindowSeparator(src);
        }

        src = withoutTrailingSlash(stripLeadingModifier(src));
    }
    src = src || 'src';

    if (dist) {
        if (windowsSeparatorReplaceable) {
            dist = replaceWindowSeparator(dist);
        }

        dist = withoutTrailingSlash(stripLeadingModifier(dist));
    }
    dist = dist || 'dist';

    if (
        input.indexOf(src) !== -1 &&
        input.indexOf(dist) === -1
    ) {
        const lastIndex = input.lastIndexOf(src);
        const prevCharacter = input.substring(lastIndex - 1, lastIndex);
        if (!prevCharacter || prevCharacter === separator) {
            input = input.substring(0, lastIndex) +
                dist +
                input.substring(lastIndex + src.length);

            baseIndex = input.lastIndexOf(separator);
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
        let matchesSum: number | undefined;
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
export async function adjustFilePath<T extends unknown | unknown[]>(
    input: T,
    tsconfig?: string | TSConfig,
): Promise<T> {
    if (isCodeTransformation(CodeTransformation.JUST_IN_TIME)) {
        return input;
    }

    if (!isObject(tsconfig)) {
        tsconfig = await readTSConfig(tsconfig);
    }

    const { compilerOptions } = tsconfig;

    if (typeof input === 'string') {
        return transformFilePath(input, compilerOptions?.outDir) as T;
    }

    if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++) {
            if (typeof input[i] === 'string') {
                input[i] = transformFilePath(input[i], compilerOptions?.outDir);
            }
        }
    }

    return input;
}

export async function adjustFilePaths<T extends Record<string, any>>(
    input: T,
    keys?: (keyof T)[],
    tsconfig?: string | TSConfig,
): Promise<T> {
    if (isCodeTransformation(CodeTransformation.JUST_IN_TIME)) {
        return input;
    }

    if (!isObject(tsconfig)) {
        tsconfig = await readTSConfig(tsconfig);
    }

    keys = keys || Object.keys(input);

    for (let i = 0; i < keys.length; i++) {
        input[keys[i]] = await adjustFilePath(input[keys[i]], tsconfig);
    }

    return input;
}

export function resolveFilePath(filePath: string, root?: string) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }

    return filePath.startsWith('/') ?
        filePath :
        path.resolve(root || process.cwd(), filePath);
}

export function parseFilePath(filePath: string, root?: string) {
    const fullPath = resolveFilePath(filePath, root);

    const directory = path.dirname(fullPath);
    const name = path.basename(fullPath);

    return {
        directory,
        name,
    };
}
