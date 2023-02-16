import {
    isObject,
    load,
    locate,
    removeFileNameExtension,
} from 'locter';
import path from 'node:path';
import { DataSource, InstanceChecker } from 'typeorm';
import { DataSourceFindOptions } from './type';
import { hasOwnProperty, isTsNodeRuntimeEnvironment } from '../../utils';
import { readTsConfig } from '../../utils/tsconfig';
import { changeTSToJSPath } from '../options';

export async function findDataSource(
    context?: DataSourceFindOptions,
) : Promise<DataSource | undefined> {
    const files : string[] = [
        'data-source',
    ];

    context = context || {};

    if (context.fileName) {
        context.fileName = removeFileNameExtension(
            context.fileName,
            ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'],
        );

        if (context.fileName !== 'data-source') {
            files.unshift(context.fileName);
        }
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

    const lookupPaths = [];
    for (let j = 0; j < files.length; j++) {
        lookupPaths.push(...[
            path.posix.join('src', files[j]),
            path.posix.join('src/{db,database}', files[j]),
        ]);
    }

    files.push(...lookupPaths);

    if (!isTsNodeRuntimeEnvironment()) {
        let tsConfigFound = false;

        for (let i = 0; i < basePaths.length; i++) {
            const { compilerOptions } = await readTsConfig(basePaths[i]);
            if (compilerOptions) {
                for (let j = 0; j < files.length; j++) {
                    files[j] = changeTSToJSPath(files[j], compilerOptions.outDir);
                }

                tsConfigFound = true;
                break;
            }
        }

        if (!tsConfigFound) {
            for (let j = 0; j < files.length; j++) {
                files[j] = changeTSToJSPath(files[j]);
            }
        }
    }

    for (let i = 0; i < files.length; i++) {
        const info = await locate(
            `${files[i]}.{ts,cts,mts,js,cjs,mjs}`,
            {
                path: basePaths,
                ignore: ['**/*.d.ts'],
            },
        );

        if (info) {
            const fileExports = await load(info);

            if (InstanceChecker.isDataSource(fileExports)) {
                return fileExports;
            }

            if (
                hasOwnProperty(fileExports, 'default') &&
                InstanceChecker.isDataSource(fileExports.default)
            ) {
                return fileExports.default;
            }

            if (isObject(fileExports)) {
                const keys = Object.keys(fileExports);
                for (let j = 0; j < keys.length; j++) {
                    const value = fileExports[keys[j]];

                    if (InstanceChecker.isDataSource(value)) {
                        return value;
                    }
                }
            }
        }
    }

    return undefined;
}
