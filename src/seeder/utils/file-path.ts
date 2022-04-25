/* istanbul ignore next */
import glob from 'glob';
import path from 'path';

export function resolveFilePatterns(
    filesPattern: string[],
    root?: string,
) : string[] {
    return filesPattern
        .map((pattern) => glob.sync(pattern, {
            ...(root ? { root } : {}),
        }))
        .reduce((acc, el) => acc.concat(el));
}

export function resolveFilePaths(
    filePaths: string[],
    root?: string,
) {
    root = root || process.cwd();

    return filePaths.map((filePath) => (
        path.isAbsolute(filePath) ?
            filePath :
            path.resolve(root, filePath)
    ));
}
