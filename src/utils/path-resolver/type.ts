import type { TSConfig } from '../tsconfig';
import type { PathResolverMode } from './constants';

export type PathResolverOptions = {
    /**
     * Root directory against which relative paths are absolutized.
     *
     * Default: process.cwd()
     */
    root?: string,

    /**
     * Tsconfig object or path to the tsconfig file,
     * resolved against the root directory.
     *
     * Default: tsconfig.json
     */
    tsconfig?: string | TSConfig,

    /**
     * preserve: never rewrite paths.
     * transform: always rewrite paths (src -> outDir, .ts -> .js).
     * auto: rewrite unless a just-in-time environment (e.g. ts-node) is detected.
     *
     * Default: auto
     */
    mode?: `${PathResolverMode}`,
};

export interface IPathResolver {
    /**
     * Absolutize a path against the root directory.
     */
    absolutize(input: string) : string;

    /**
     * Rewrite a path for the runtime environment (src -> outDir, .ts -> .js),
     * depending on the resolver mode.
     */
    transform(input: string) : Promise<string>;

    /**
     * Transform the (string or string-array) values of the given keys in place.
     */
    transformKeys<T extends Record<string, any>>(input: T, keys?: (keyof T)[]) : Promise<T>;

    /**
     * Absolutize and transform a path.
     */
    resolve(input: string) : Promise<string>;

    /**
     * The lazily read tsconfig backing the transformation.
     */
    tsconfig() : Promise<TSConfig>;
}
