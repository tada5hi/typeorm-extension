import path from 'path';
import { DataSource, InstanceChecker } from 'typeorm';
import { loadFile, locateFile } from '../../file';
import { DataSourceFindContext } from './type';
import { isTsNodeRuntimeEnvironment } from '../../utils';
import { readTsConfig } from '../../utils/tsconfig';
import { changeTStoJSPath } from '../options';

export async function findDataSource(
    context?: DataSourceFindContext,
) : Promise<DataSource | undefined> {
    const fileNames : string[] = [
        'data-source',
    ];

    context = context || {};

    if (context.fileName) {
        fileNames.unshift(context.fileName);
    }

    let directory = context.directory || process.cwd();
    directory = path.isAbsolute(directory) ?
        directory :
        path.join(process.cwd(), directory);

    const paths : string[] = [
        path.join(directory, 'src', 'db'),
        path.join(directory, 'src', 'database'),
        path.join(directory, 'src'),
    ];

    if (!isTsNodeRuntimeEnvironment()) {
        let { compilerOptions } = await readTsConfig(directory);
        compilerOptions = compilerOptions || {};

        paths.map((item) => changeTStoJSPath(item, { dist: compilerOptions.outDir }));
    }

    paths.unshift(directory);

    for (let i = 0; i < fileNames.length; i++) {
        const info = await locateFile(fileNames[i], {
            paths,
            extensions: ['.js', '.ts'],
        });

        if (info) {
            const fileExports = await loadFile(info);
            if (InstanceChecker.isDataSource(fileExports)) {
                return fileExports;
            }

            if (typeof fileExports === 'object') {
                const keys = Object.keys(fileExports);
                for (let j = 0; j < keys.length; j++) {
                    if (InstanceChecker.isDataSource((fileExports as Record<string, any>)[keys[i]])) {
                        return (fileExports as Record<string, any>)[keys[i]];
                    }
                }
            }
        }
    }

    return undefined;
}
