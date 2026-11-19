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

    try {
        // get-tsconfig resolves package parents to their real path, so the
        // file read is resolved too, keeping the relative paths short.
        tsConfig = parseTsconfig(fs.realpathSync(filePath)) as TSConfig;
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

        tsConfig.compilerOptions = compilerOptions;
    }

    return tsConfig;
}
