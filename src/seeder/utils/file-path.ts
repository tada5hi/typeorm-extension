/* istanbul ignore next */
import glob from 'glob';
import path from 'path';

export function resolveFilePaths(filesPattern: string[]) : string[] {
    return filesPattern
        .map((pattern) => glob.sync(
            path.isAbsolute(pattern) ?
                pattern :
                path.resolve(process.cwd(), pattern),
        ))
        .reduce((acc, el) => acc.concat(el));
}
