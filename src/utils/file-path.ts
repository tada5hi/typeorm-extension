import path from 'node:path';
import { canReplaceWindowsSeparator, replaceWindowSeparator } from './separator';
import { withoutTrailingSlash } from './slash';

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
        input.includes(src) &&
        !input.includes(dist)
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

    const jsExtensions = ['js', 'cjs', 'mjs'];

    // if the path already contains a js-family file extension (as a real
    // extension at end-of-name or inside a glob brace expansion, not just
    // anywhere in the basename — `my-json.ts` must still be transformable),
    // we are done.
    const jsExtensionRegex = /(?:^|[./{,])(?:js|cjs|mjs)(?:[}.,]|$)/;
    if (jsExtensionRegex.test(base)) {
        return input;
    }

    const tsExtensions = ['ts', 'cts', 'mts'];
    for (const [i, tsExtension] of tsExtensions.entries()) {
        const regex = new RegExp(`(\\.${tsExtension}|${tsExtension})`, 'g');
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
