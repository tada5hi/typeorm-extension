import {
    isObject,
    load,
    locate,
    removeFileNameExtension,
} from 'locter';
import path from 'node:path';
import type { DataSource } from 'typeorm';
import { InstanceChecker } from 'typeorm';
import {
    CodeTransformation,
    adjustFilePath,
    isCodeTransformation,
    isPromise, readTSConfig,
    safeReplaceWindowsSeparator,
} from '../../utils';
import type { DataSourceFindOptions } from './type';
import type { TSConfig } from '../../utils';

export async function findDataSource(
    context?: DataSourceFindOptions,
) : Promise<DataSource | undefined> {
    context = context || {};

    let tsconfig : TSConfig | undefined;
    if (!context.preserveFilePaths) {
        if (isObject(context.tsconfig)) {
            tsconfig = context.tsconfig;
        } else {
            tsconfig = await readTSConfig(context.tsconfig);
        }
    }

    const files : string[] = [
        'data-source',
    ];

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

        if (!context.preserveFilePaths) {
            directory = await adjustFilePath(directory);
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

    if (
        !context.preserveFilePaths &&
        !isCodeTransformation(CodeTransformation.JUST_IN_TIME)
    ) {
        for (let j = 0; j < files.length; j++) {
            files[j] = await adjustFilePath(files[j], tsconfig);
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
            let moduleRecord = await load(info);

            if (isPromise(moduleRecord)) {
                moduleRecord = await moduleRecord;
            }

            if (InstanceChecker.isDataSource(moduleRecord)) {
                return moduleRecord;
            }

            if (!isObject(moduleRecord)) {
                continue;
            }

            const keys = Object.keys(moduleRecord);
            for (let j = 0; j < keys.length; j++) {
                let value = moduleRecord[keys[j]];

                if (isPromise(value)) {
                    value = await value;
                }

                if (InstanceChecker.isDataSource(value)) {
                    return value;
                }
            }
        }
    }

    return undefined;
}
