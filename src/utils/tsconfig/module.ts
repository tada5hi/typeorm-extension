import { parseTsconfig } from 'get-tsconfig';
import { read } from 'locter';
import fs from 'node:fs';
import path from 'node:path';
import { isObject } from '../object';
import type { TSConfig } from './types';

/**
 * Compiler options holding a path. get-tsconfig resolves them relative
 * to the file read and prefixes them with "./"; the prefix is dropped,
 * so the value can be used as a path segment (e.g. outDir: "dist").
 */
const PATH_COMPILER_OPTIONS = [
    'outDir',
    'rootDir',
    'baseUrl',
    'declarationDir',
] as const;

function stripCurrentDirectoryPrefix(input: string) : string {
    if (input === './' || input === '.') {
        return '.';
    }

    return input.startsWith('./') ? input.substring(2) : input;
}

async function readTSConfigFile(filePath: string) : Promise<TSConfig> {
    try {
        const tsConfig = await read(filePath);

        if (isObject(tsConfig)) {
            return tsConfig;
        }
    } catch {
        // don't do anything ;)
    }

    return {};
}

const READ_CACHE_KEY = /^readFileSync:(.+):utf8$/;

/**
 * get-tsconfig 4 treats an absolute path option set in a parent config as
 * relative to that parent (outDir "/app/dist" in config/base.json becomes
 * "config/app/dist"). The files of the extends chain are taken from the
 * read cache of the first parse; each parent is parsed on its own (its
 * parents read as empty objects), and if it sets an absolute value whose
 * mangled form is the merged value, the absolute value is restored.
 */
function restoreInheritedAbsolutePaths(
    compilerOptions: NonNullable<TSConfig['compilerOptions']>,
    filePath: string,
    cache: Map<string, any>,
) : void {
    const files = cache.keys().toArray()
        .map((key) => READ_CACHE_KEY.exec(key)?.[1])
        .filter((file): file is string => !!file);

    if (files.length < 2) {
        return;
    }

    // the path options a file sets itself, with the files it extends read as {}
    const readOwn = (file: string) => {
        const fileCache = new Map(cache);

        for (const other of files) {
            if (other !== file) {
                fileCache.set(`readFileSync:${other}:utf8`, '{}');
            }
        }

        try {
            return (parseTsconfig(file, fileCache) as TSConfig).compilerOptions || {};
        } catch {
            return {};
        }
    };

    const keys = PATH_COMPILER_OPTIONS.filter(
        (key) => typeof compilerOptions[key] === 'string' &&
            typeof readOwn(filePath)[key] === 'undefined',
    );

    for (const file of files) {
        if (file === filePath || keys.length === 0) {
            continue;
        }

        const own = readOwn(file);

        for (const key of keys) {
            const value = own[key];

            if (typeof value !== 'string') {
                continue;
            }

            const absolute = stripCurrentDirectoryPrefix(value);

            if (!path.isAbsolute(absolute)) {
                continue;
            }

            const mangled = path.relative(
                path.dirname(filePath),
                path.join(path.dirname(file), absolute),
            ).split(path.sep).join('/');

            if (compilerOptions[key] === mangled) {
                compilerOptions[key] = absolute;
            }
        }
    }
}

/**
 * Read a tsconfig file (or the tsconfig.json of a directory).
 *
 * The file is parsed with get-tsconfig: comments and trailing commas are
 * allowed, and the extends chain (relative paths, package specifiers,
 * arrays) is followed and merged. Path options inherited from a parent
 * (outDir, rootDir, ...) are relative to the directory of the file read.
 * If the extends chain can not be resolved (missing parent, cycle), the
 * file is read alone, as plain JSON. A missing or unreadable file yields
 * an empty object.
 */
export async function readTSConfig(input?: string) : Promise<TSConfig> {
    input = input || process.cwd();
    input = path.isAbsolute(input) ?
        input :
        path.resolve(process.cwd(), input);

    const filePath = !input.includes('.json') ?
        path.join(input, 'tsconfig.json') :
        input;

    let tsConfig : TSConfig;
    let realPath : string;
    const cache = new Map<string, any>();

    try {
        // get-tsconfig resolves package parents to their real path, so the
        // file read is resolved too, keeping the relative paths short.
        realPath = fs.realpathSync(filePath);
        tsConfig = parseTsconfig(realPath, cache) as TSConfig;
    } catch {
        // e.g. a parent in the extends chain is missing (a @tsconfig/* base
        // pruned with the devDependencies) or the chain is cyclic:
        // read the file alone, without following extends.
        return readTSConfigFile(filePath);
    }

    if (!isObject(tsConfig)) {
        return {};
    }

    if (tsConfig.compilerOptions) {
        const compilerOptions = { ...tsConfig.compilerOptions };

        for (const key of PATH_COMPILER_OPTIONS) {
            const value = compilerOptions[key];

            if (typeof value === 'string') {
                compilerOptions[key] = stripCurrentDirectoryPrefix(value);
            }
        }

        restoreInheritedAbsolutePaths(compilerOptions, realPath, cache);

        tsConfig.compilerOptions = compilerOptions;
    }

    return tsConfig;
}
