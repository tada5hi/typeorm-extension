import fs from 'node:fs';
import path from 'node:path';
import { locateMany } from 'locter';
import { isObject } from '../object';
import { CodeTransformation, isCodeTransformation } from '../code-transformation';
import { resolveFilePath, transformFilePath } from '../file-path';
import { safeReplaceWindowsSeparator } from '../separator';
import type { TSConfig } from '../tsconfig';
import { readTSConfig } from '../tsconfig';
import { PathResolverMode } from './constants';
import type { IPathResolver, PathResolverOptions } from './types';

export class PathResolver implements IPathResolver {
    protected root?: string;

    protected mode: `${PathResolverMode}`;

    protected tsconfigInput?: string | TSConfig;

    protected tsconfigPromise?: Promise<TSConfig>;

    protected typescript?: boolean;

    constructor(options: PathResolverOptions = {}) {
        this.root = options.root;
        this.mode = options.mode || PathResolverMode.AUTO;
        this.tsconfigInput = options.tsconfig;
        this.typescript = options.typescript;
    }

    absolutize(input: string) : string {
        return resolveFilePath(input, this.root);
    }

    async resolve(input: string) : Promise<string> {
        return this.transform(this.absolutize(input));
    }

    async transform(input: string) : Promise<string> {
        if (!this.shouldTransform()) {
            return input;
        }

        const { compilerOptions } = await this.tsconfig();

        const output = transformFilePath(input, compilerOptions?.outDir);

        if (
            this.mode !== PathResolverMode.AUTO ||
            output === input
        ) {
            return output;
        }

        // auto mode: the build path wins, the source path is the fallback on a miss.
        if (await this.matches(output)) {
            return output;
        }

        if (await this.matches(input, true)) {
            return input;
        }

        return output;
    }

    async transformKeys<T extends Record<string, any>>(
        input: T,
        keys?: (keyof T)[],
    ) : Promise<T> {
        if (!this.shouldTransform()) {
            return input;
        }

        keys = keys || Object.keys(input);

        for (const key of keys) {
            const value = input[key];

            if (typeof value === 'string') {
                input[key] = await this.transform(value) as T[keyof T];

                continue;
            }

            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] === 'string') {
                        value[i] = await this.transform(value[i]);
                    }
                }
            }
        }

        return input;
    }

    async tsconfig() : Promise<TSConfig> {
        if (!this.tsconfigPromise) {
            this.tsconfigPromise = this.readTsconfig();
        }

        return this.tsconfigPromise;
    }

    protected async readTsconfig() : Promise<TSConfig> {
        if (isObject(this.tsconfigInput)) {
            return this.tsconfigInput;
        }

        return readTSConfig(
            resolveFilePath(this.tsconfigInput || 'tsconfig.json', this.root),
        );
    }

    /**
     * Check if a path (file, directory or glob pattern) points to something
     * on disk. With loadable set, a typescript file only counts
     * when the runtime can load typescript.
     */
    protected async matches(input: string, loadable?: boolean) : Promise<boolean> {
        const filePath = this.absolutize(input);

        try {
            const stat = await fs.promises.stat(filePath);

            return stat.isDirectory() || !loadable || this.isLoadable(filePath);
        } catch {
            // not a plain path, maybe a glob pattern
        }

        if (!/[*?[\]{}]/.test(input)) {
            return false;
        }

        try {
            const files = await locateMany(safeReplaceWindowsSeparator(input), {
                cwd: this.root ? this.absolutize('.') : process.cwd(),
                ignore: ['**/*.d.ts'],
            });

            return files.some((file) => !loadable || this.isLoadable(file.path));
        } catch {
            return false;
        }
    }

    protected isLoadable(filePath: string) : boolean {
        if (!['.ts', '.mts', '.cts'].includes(path.extname(filePath))) {
            return true;
        }

        return this.canLoadTypeScript();
    }

    protected canLoadTypeScript() : boolean {
        if (typeof this.typescript === 'boolean') {
            return this.typescript;
        }

        return isCodeTransformation(CodeTransformation.JUST_IN_TIME) ||
            !!process.features.typescript;
    }

    protected shouldTransform() : boolean {
        if (this.mode === PathResolverMode.PRESERVE) {
            return false;
        }

        if (this.mode === PathResolverMode.TRANSFORM) {
            return true;
        }

        return !isCodeTransformation(CodeTransformation.JUST_IN_TIME);
    }
}

export function createPathResolver(options: PathResolverOptions = {}) : IPathResolver {
    return new PathResolver(options);
}
