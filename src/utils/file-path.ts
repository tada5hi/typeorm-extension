import path from 'node:path';
import { CodeTransformation, isCodeTransformation } from './code-transformation';
import { safeReplaceWindowsSeparator } from './separator';
import { withoutTrailingSlash } from './slash';
import { readTsConfig } from './tsconfig';

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

export async function adjustFilePaths<T extends Record<string, any>>(
    input: T,
    keys?: (keyof T)[],
    rootDirectory?: string,
): Promise<T> {
    if (isCodeTransformation(CodeTransformation.JUST_IN_TIME)) {
        return input;
    }

    const { compilerOptions } = await readTsConfig(rootDirectory);

    keys = keys || Object.keys(input);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        let value = input[key] as unknown;

        if (typeof value === 'string') {
            value = transformFilePath(value, compilerOptions?.outDir);
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] === 'string') {
                    value[i] = transformFilePath(value[i], compilerOptions?.outDir);
                }
            }
        }

        input[key] = value as T[keyof T];
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
