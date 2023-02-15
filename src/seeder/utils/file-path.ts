/* istanbul ignore next */
import path from 'path';
import { locateMany } from 'locter';

export async function resolveFilePatterns(
    filesPattern: string[],
    root?: string,
) : Promise<string[]> {
    return locateMany(
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
    return filePaths.map((filePath) => (
        path.isAbsolute(filePath) ?
            filePath :
            path.resolve(root || process.cwd(), filePath)
    ));
}
