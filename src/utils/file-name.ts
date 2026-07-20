import path from 'node:path';

export function getFileNameExtension(
    input: string,
    allowed?: string[],
) : string | undefined {
    const extension = path.extname(input);
    if (extension === '' || extension === '.') {
        return undefined;
    }

    if (
        typeof allowed === 'undefined' ||
        allowed.includes(extension)
    ) {
        return extension;
    }

    return undefined;
}

export function removeFileNameExtension(
    input: string,
    extensions?: string[],
) {
    const extension = getFileNameExtension(input, extensions);
    if (extension) {
        return input.substring(0, input.length - extension.length);
    }

    return input;
}
