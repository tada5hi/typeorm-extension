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
import { changeTSToJSPath, safeReplaceWindowsSeparator } from '../options';

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

    let { directory } = context;
    let directoryIsPattern = false;
    if (context.directory) {
        if (path.isAbsolute(context.directory)) {
            directory = context.directory;
        } else {
            directoryIsPattern = true;
            directory = safeReplaceWindowsSeparator(context.directory);
        }
    }

    const lookupPaths = [];
    for (let j = 0; j < files.length; j++) {
        if (
            directory &&
            directoryIsPattern
        ) {
            lookupPaths.push(path.posix.join(directory, files[j]));
        }

        lookupPaths.push(...[
            path.posix.join('src', files[j]),
            path.posix.join('src/{db,database}', files[j]),
        ]);
    }

    files.push(...lookupPaths);

    if (!isTsNodeRuntimeEnvironment()) {
        const { compilerOptions } = await readTsConfig();
        const outDir = compilerOptions ? compilerOptions.outDir : undefined;

        for (let j = 0; j < files.length; j++) {
            files[j] = changeTSToJSPath(files[j], outDir);
        }
    }

    for (let i = 0; i < files.length; i++) {
        const info = await locate(
            `${files[i]}.{js,cjs,mjs,ts,cts,mts}`,
            {
                path: [
                    process.cwd(),
                    ...(directory && !directoryIsPattern ? [directory] : []),
                ],
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
