/* istanbul ignore next */
import type { LocatorInfo } from 'locter';
import { locateMany } from 'locter';
import path from 'path';

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
    ).then(buildFilePathname);
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

/**
 * Exported only for testing purposes
 */
export function buildFilePathname(files: LocatorInfo[]) {
    return (
        // sorting by name so that we can define the order of execution using file names
        files.sort((a, b) => (a.name > b.name ? 1 : -1)).map((el) => path.join(el.path, el.name + el.extension))
    );
}
