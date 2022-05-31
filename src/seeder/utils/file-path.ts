/* istanbul ignore next */
import path from 'path';
import { locateFilesSync } from 'locter';

export async function resolveFilePatterns(
    filesPattern: string[],
    root?: string,
) : Promise<string[]> {
    return locateFilesSync(
        filesPattern,
        {
            ...(root ? { path: root } : {}),
        },
    ).map((el) => path.join(el.path, el.fileName + el.fileExtension));
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
