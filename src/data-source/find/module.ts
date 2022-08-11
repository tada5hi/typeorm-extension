import path from 'path';
import { DataSource, InstanceChecker } from 'typeorm';
import { loadScriptFile, locateFile } from 'locter';
import { DataSourceFindOptions } from './type';
import { isTsNodeRuntimeEnvironment } from '../../utils';
import { readTsConfig } from '../../utils/tsconfig';
import { changeTSToJSPath } from '../options';

export async function findDataSource(
    context?: DataSourceFindOptions,
) : Promise<DataSource | undefined> {
    const fileNames : string[] = [
        'data-source',
    ];

    context = context || {};

    if (
        context.fileName &&
        context.fileName !== 'data-source'
    ) {
        fileNames.unshift(context.fileName);
    }

    const basePaths = [
        process.cwd(),
    ];

    if (
        context.directory &&
        context.directory !== process.cwd()
    ) {
        context.directory = path.isAbsolute(context.directory) ?
            context.directory :
            path.join(process.cwd(), context.directory);

        basePaths.unshift(context.directory);
    }

    const directories = [
        path.join('src', 'db'),
        path.join('src', 'database'),
        path.join('src'),
    ];

    let paths : string[] = [];
    for (let i = 0; i < basePaths.length; i++) {
        paths.push(basePaths[i]);
        for (let j = 0; j < directories.length; j++) {
            paths.push(path.join(basePaths[i], directories[j]));
        }
    }

    if (!isTsNodeRuntimeEnvironment()) {
        let tsConfigFound = false;

        for (let i = 0; i < basePaths.length; i++) {
            const { compilerOptions } = await readTsConfig(basePaths[i]);
            if (compilerOptions) {
                paths = paths.map((item) => changeTSToJSPath(item, { dist: compilerOptions.outDir }));
                tsConfigFound = true;
                break;
            }
        }

        if (!tsConfigFound) {
            paths = paths.map((item) => changeTSToJSPath(item));
        }
    }

    for (let i = 0; i < fileNames.length; i++) {
        const info = await locateFile(`${fileNames[i]}.{js,ts}`, {
            path: paths,
            ignore: ['**/*.d.ts'],
        });

        if (info) {
            const fileExports = await loadScriptFile(info);
            if (InstanceChecker.isDataSource(fileExports)) {
                return fileExports;
            }

            if (typeof fileExports === 'object') {
                const keys = Object.keys(fileExports);
                for (let j = 0; j < keys.length; j++) {
                    const value = (fileExports as Record<string, any>)[keys[j]];

                    if (InstanceChecker.isDataSource(value)) {
                        return value;
                    }
                }
            }
        }
    }

    return undefined;
}
