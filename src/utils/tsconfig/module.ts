import { parseTsconfig } from 'get-tsconfig';
import { read, resolveModuleSync } from 'locter';
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
 * Read a config file as plain JSON. A file with comments yields undefined.
 */
function readRawConfig(filePath: string) : Record<string, any> | undefined {
    try {
        const output = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        return isObject(output) ? output : undefined;
    } catch {
        return undefined;
    }
}

function isFile(filePath: string) : boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function resolveExtends(specifier: string, configPath: string) : string | undefined {
    if (path.isAbsolute(specifier) || specifier.startsWith('.')) {
        const filePath = path.resolve(path.dirname(configPath), specifier);

        return [filePath, `${filePath}.json`].find((el) => isFile(el));
    }

    const candidates = specifier.endsWith('.json') ?
        [specifier] :
        [`${specifier}.json`, `${specifier}/tsconfig.json`, specifier];

    for (const candidate of candidates) {
        try {
            // tsc and get-tsconfig resolve extends like require() plus
            // "types", never "import": with the defaults (node, import) an
            // import entry listed first would pick another parent.
            const filePath = resolveModuleSync(candidate, {
                parentURL: configPath,
                conditions: ['node', 'require', 'types'],
                defaultConditions: false,
            });

            if (filePath.endsWith('.json')) {
                return filePath;
            }
        } catch {
            // try the next candidate
        }
    }

    return undefined;
}

/**
 * Find the raw value a config file or its extends chain sets for a compiler
 * option, in tsc precedence (the file itself, then its parents from the last
 * to the first). null: the chain can not be read as plain JSON (comments)
 * or resolved, so the value is unknown.
 */
function findRawCompilerOption(
    configPath: string,
    key: string,
    visited: Set<string> = new Set(),
) : unknown {
    if (visited.has(configPath)) {
        return null;
    }

    visited.add(configPath);

    const config = readRawConfig(configPath);

    if (!config) {
        return null;
    }

    if (isObject(config.compilerOptions) && key in config.compilerOptions) {
        return config.compilerOptions[key];
    }

    const specifiers : unknown[] = Array.isArray(config.extends) ?
        config.extends :
        [config.extends];

    for (const specifier of specifiers.reverse()) {
        if (typeof specifier !== 'string') {
            continue;
        }

        const parentPath = resolveExtends(specifier, configPath);

        if (!parentPath) {
            return null;
        }

        const value = findRawCompilerOption(parentPath, key, visited);

        if (value !== undefined) {
            return value;
        }
    }

    return undefined;
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

    try {
        // get-tsconfig resolves package parents to their real path, so the
        // file read is resolved too, keeping the relative paths short.
        realPath = fs.realpathSync(filePath);
        tsConfig = parseTsconfig(realPath) as TSConfig;
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

            if (typeof value !== 'string') {
                continue;
            }

            // get-tsconfig 4 resolves an absolute value set in a parent as if
            // it were relative to that parent, so such a value is looked up
            // in the raw files of the extends chain.
            const raw = findRawCompilerOption(realPath, key);

            compilerOptions[key] = typeof raw === 'string' && path.isAbsolute(raw) ?
                raw :
                stripCurrentDirectoryPrefix(value);
        }

        tsConfig.compilerOptions = compilerOptions;
    }

    return tsConfig;
}
