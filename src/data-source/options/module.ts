import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../errors';
import { PathResolverMode, createPathResolver } from '../../utils';
import { findDataSource } from '../find';
import type { DataSourceOptionsBuildContext } from './type';
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

    const dataSource = await findDataSource({
        directory,
        fileName: context.dataSourceName,
        tsconfig: context.tsconfig,
        preserveFilePaths: context.preserveFilePaths,
    });

    if (dataSource) {
        const options = await pathResolver.transformKeys(
            dataSource.options,
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
