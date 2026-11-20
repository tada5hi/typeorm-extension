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
     * auto: rewrite unless a just-in-time environment (e.g. ts-node, tsx) is detected.
     * If the rewritten path matches nothing on disk, but the original path does,
     * the original path is used (e.g. Node's type stripping without a build).
     *
     * Default: auto
     */
    mode?: `${PathResolverMode}`,

    /**
     * Whether the runtime can load typescript files.
     * In auto mode, an original path is only used as fallback
     * for a typescript file when this is true.
     *
     * Default: true under ts-node, tsx or Node's type stripping
     * (process.features.typescript), otherwise false.
     */
    typescript?: boolean,
};

export interface IPathResolver {
    /**
     * Absolutize a path against the root directory.
     */
    absolutize(input: string) : string;

    /**
     * Rewrite a path for the runtime environment (src -> outDir, .ts -> .js),
     * depending on the resolver mode. In auto mode, the original path is
     * returned when only it (and not the rewritten one) exists or matches.
     */
    transform(input: string) : Promise<string>;

    /**
     * Pick the directory to search a (relative) file pattern in: in auto mode
     * the rewritten (build) directory if the pattern matches a file there,
     * else the source directory if the pattern matches only loadable files
     * there, else the rewritten directory. Preserve mode returns the source
     * directory, transform mode the rewritten one.
     */
    resolveDirectory(directory: string, pattern: string) : Promise<string>;

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
