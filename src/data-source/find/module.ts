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
    adjustFilePath,
    isPromise,
    readTSConfig,
    safeReplaceWindowsSeparator,
} from '../../utils';
import type { DataSourceFindOptions } from './type';
import type { TSConfig } from '../../utils';

export async function findDataSource(
    context: DataSourceFindOptions = {},
) : Promise<DataSource | undefined> {
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
            directory = await adjustFilePath(directory, tsconfig);
        }
    }

    const lookupPaths = [];
    for (const file of files) {
        if (
            directory &&
            directoryIsPattern
        ) {
            lookupPaths.push(path.posix.join(directory, file));
        }

        lookupPaths.push(...[
            path.posix.join('src', file),
            path.posix.join('src/{db,database}', file),
        ]);
    }

    files.push(...lookupPaths);

    if (!context.preserveFilePaths) {
        for (let j = 0; j < files.length; j++) {
            files[j] = await adjustFilePath(files[j], tsconfig);
        }
    }

    for (const file of files) {
        const info = await locate(
            `${file}.{js,cjs,mjs,ts,cts,mts}`,
            {
                cwd: [
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
            for (const key of keys) {
                let value = moduleRecord[key];

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
