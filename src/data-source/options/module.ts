import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../errors';
import { PathResolverMode, createPathResolver } from '../../utils';
import { findDataSourceOptions } from '../find';
import type { DataSourceOptionsBuildContext } from './types';
import {
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
} from './utils';

/**
 * Build DataSourceOptions from DataSource or from configuration.
 *
 * @param context
 */
export async function buildDataSourceOptions(
    context: DataSourceOptionsBuildContext = {},
) : Promise<DataSourceOptions> {
    const directory : string = context.directory || process.cwd();

    const pathResolver = createPathResolver({
        tsconfig: context.tsconfig,
        mode: context.preserveFilePaths ?
            PathResolverMode.PRESERVE :
            PathResolverMode.AUTO,
    });

    const fileOptions = await findDataSourceOptions({
        directory,
        fileName: context.dataSourceName,
        tsconfig: context.tsconfig,
        preserveFilePaths: context.preserveFilePaths,
    });

    if (fileOptions) {
        const options = await pathResolver.transformKeys(
            fileOptions,
            ['entities', 'migrations', 'subscribers'],
        );

        return mergeDataSourceOptionsWithEnv(options);
    }

    const options = readDataSourceOptionsFromEnv();

    if (options) {
        return pathResolver.transformKeys(
            options,
            ['entities', 'migrations', 'subscribers'],
        );
    }

    throw OptionsError.notFound();
}
