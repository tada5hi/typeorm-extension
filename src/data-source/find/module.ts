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

    const names = [...files];
    const candidates : string[] = [];

    if (context.directory && path.isAbsolute(context.directory)) {
        // The directory is not rewritten on its own: an existing (possibly
        // empty) build directory would win over the source directory. Each
        // full candidate is rewritten instead, so the build file only wins
        // when it exists.
        const directory = safeReplaceWindowsSeparator(context.directory);

        for (const name of names) {
            candidates.push(name, path.posix.join(directory, name));
        }
    } else {
        candidates.push(...names);

        if (context.directory) {
            const directory = safeReplaceWindowsSeparator(context.directory);

            for (const name of names) {
                candidates.push(path.posix.join(directory, name));
            }
        }
    }

    for (const name of names) {
        candidates.push(
            path.posix.join('src', name),
            path.posix.join('src/{db,database}', name),
        );
    }

    for (const candidate of candidates) {
        // the extensions are part of the pattern, so the resolver can check
        // whether the rewritten (build) path matches a file.
        const pattern = await pathResolver.transform(`${candidate}.{js,cjs,mjs,ts,cts,mts}`);

        const info = await locate(pattern, {
            cwd: process.cwd(),
            ignore: ['**/*.d.ts'],
        });

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
