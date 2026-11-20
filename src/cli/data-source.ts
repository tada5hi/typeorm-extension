import {
    PathResolverMode,
    createPathResolver,
    parseFilePath,
} from '../utils';
import type { CLIDataSourceArgs, CLIDataSourceContext } from './types';

/**
 * Turn the data source arguments of a CLI command into the context for
 * buildDataSourceOptions. The -d path is only absolutized here: the
 * src -> outDir rewrite happens in the data source discovery, against
 * full file names (with extensions), so an extensionless path works too.
 */
export async function buildCLIDataSourceContext(args: CLIDataSourceArgs) : Promise<CLIDataSourceContext> {
    const pathResolver = createPathResolver({
        root: args.root,
        tsconfig: args.tsconfig,
        mode: args.preserveFilePaths ?
            PathResolverMode.PRESERVE :
            PathResolverMode.AUTO,
    });

    const source = parseFilePath(pathResolver.absolutize(args.dataSource));

    return {
        pathResolver,
        context: {
            directory: source.directory,
            dataSourceName: source.name,
            tsconfig: await pathResolver.tsconfig(),
            preserveFilePaths: args.preserveFilePaths,
        },
    };
}
