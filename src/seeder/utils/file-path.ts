/* istanbul ignore next */
import path from 'path';
import { locateFiles } from 'locter';

export async function resolveFilePatterns(
    filesPattern: string[],
    root?: string,
) : Promise<string[]> {
    return locateFiles(
        filesPattern,
        {
            ...(root ? { path: root } : {}),
            ignore: ['**/*.d.ts'],
        },
    ).then((files) => files.map((el) => path.join(el.path, el.name + el.extension)));
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
