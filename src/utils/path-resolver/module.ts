import { isObject } from 'locter';
import { CodeTransformation, isCodeTransformation } from '../code-transformation';
import { resolveFilePath, transformFilePath } from '../file-path';
import type { TSConfig } from '../tsconfig';
import { readTSConfig } from '../tsconfig';
import { PathResolverMode } from './constants';
import type { IPathResolver, PathResolverOptions } from './type';

export class PathResolver implements IPathResolver {
    protected root?: string;

    protected mode: `${PathResolverMode}`;

    protected tsconfigInput?: string | TSConfig;

    protected tsconfigPromise?: Promise<TSConfig>;

    constructor(options: PathResolverOptions = {}) {
        this.root = options.root;
        this.mode = options.mode || PathResolverMode.AUTO;
        this.tsconfigInput = options.tsconfig;
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

        return transformFilePath(input, compilerOptions?.outDir);
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
