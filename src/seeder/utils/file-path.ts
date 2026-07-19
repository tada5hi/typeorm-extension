import type { LocatorInfo } from 'locter';
import { buildFilePath, locateMany } from 'locter';
import { resolveFilePath } from '../../utils';

export async function resolveFilePatterns(
    filesPattern: string[],
    root?: string,
) : Promise<string[]> {
    return locateMany(
        filesPattern,
        {
            ...(root ? { cwd: root } : {}),
            ignore: ['**/*.d.ts'],
        },
    ).then(buildFilePathname);
}

export function resolveFilePaths(
    filePaths: string[],
    root?: string,
) {
    return filePaths.map((filePath) => resolveFilePath(filePath, root));
}

function buildFilePathname(files: LocatorInfo[]) {
    return (
        // sorting by name so that we can define the order of execution using file names
        files.sort((a, b) => (a.name > b.name ? 1 : -1)).map((el) => buildFilePath(el))
    );
}
