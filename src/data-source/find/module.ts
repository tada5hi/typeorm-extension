import {
    locate,
    readAsModule,
    removeFileNameExtension,
} from 'locter';
import {
    PathResolverMode,
    createPathResolver,
    isObject,
    isPromise,
    safeReplaceWindowsSeparator,
} from '../../utils';
import path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DataSource, InstanceChecker } from 'typeorm';
import type { DataSourceFindOptions } from './types';

type DataSourceFactory = () => unknown;

function isDataSourceFactory(value: unknown) : value is DataSourceFactory {
    if (typeof value !== 'function' || value.length > 0) {
        return false;
    }

    // A class is a function too, but calling it without new throws.
    return !/^class[\s{]/.test(Function.prototype.toString.call(value));
}

function isDataSourceOptions(value: unknown) : value is DataSourceOptions {
    return isObject(value) &&
        typeof value.type === 'string' &&
        !InstanceChecker.isDataSource(value);
}

/**
 * Pick a DataSource from a module record. Precedence: a DataSource
 * (or a promise of one), then a default export factory without
 * parameters whose (awaited) result is a DataSource, then plain
 * DataSourceOptions (returned as they are, no DataSource is constructed:
 * that would load the driver package). Named exports are never called.
 *
 * @param input
 */
async function extractDataSource(input: unknown) : Promise<DataSource | DataSourceOptions | undefined> {
    let moduleRecord = input;

    if (isPromise(moduleRecord)) {
        moduleRecord = await moduleRecord;
    }

    if (InstanceChecker.isDataSource(moduleRecord)) {
        return moduleRecord;
    }

    const values : unknown[] = [];
    let factory : unknown;

    if (typeof moduleRecord === 'function') {
        factory = moduleRecord;
    } else if (isObject(moduleRecord)) {
        const keys = Object.keys(moduleRecord);

        for (const key of keys) {
            let value = moduleRecord[key];

            if (isPromise(value)) {
                value = await value;
            }

            if (InstanceChecker.isDataSource(value)) {
                return value;
            }

            if (key === 'default') {
                factory = value;
            }

            values.push(value);
        }
    } else {
        return undefined;
    }

    if (isDataSourceFactory(factory)) {
        const output = await factory();

        if (InstanceChecker.isDataSource(output)) {
            return output;
        }
    }

    const options = values.find((value) => isDataSourceOptions(value));

    if (options) {
        return options as DataSourceOptions;
    }

    return undefined;
}

async function findDataSourceExport(
    context: DataSourceFindOptions,
) : Promise<DataSource | DataSourceOptions | undefined> {
    const pathResolver = createPathResolver({
        tsconfig: context.tsconfig,
        mode: context.preserveFilePaths ?
            PathResolverMode.PRESERVE :
            PathResolverMode.AUTO,
    });

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

        directory = await pathResolver.transform(directory);
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

    for (let j = 0; j < files.length; j++) {
        files[j] = await pathResolver.transform(files[j]);
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
            const output = await extractDataSource(await readAsModule(info));

            if (output) {
                return output;
            }
        }
    }

    return undefined;
}

/**
 * Locate the data source file and return its DataSource. An exported
 * DataSourceOptions object is wrapped in a new DataSource.
 *
 * @param context
 */
export async function findDataSource(
    context: DataSourceFindOptions = {},
) : Promise<DataSource | undefined> {
    const output = await findDataSourceExport(context);

    if (!output || InstanceChecker.isDataSource(output)) {
        return output;
    }

    return new DataSource(output);
}

/**
 * Locate the data source file and return its options, without constructing
 * a DataSource for exported options (which would load the driver package).
 *
 * @param context
 */
export async function findDataSourceOptions(
    context: DataSourceFindOptions = {},
) : Promise<DataSourceOptions | undefined> {
    const output = await findDataSourceExport(context);

    if (!output) {
        return undefined;
    }

    return InstanceChecker.isDataSource(output) ?
        output.options :
        output;
}
