import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../errors';
import { findDataSource } from '../find';
import type { DataSourceOptionsBuildContext } from './type';
import {
    adjustFilePathsForDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
} from './utils';

export async function extendDataSourceOptions(
    options: DataSourceOptions,
    tsConfigDirectory?: string,
) : Promise<DataSourceOptions> {
    await adjustFilePathsForDataSourceOptions(options, { root: tsConfigDirectory });

    return options;
}

/**
 * Build DataSourceOptions from DataSource or from configuration.
 *
 * @param context
 */
export async function buildDataSourceOptions(
    context?: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions> {
    context = context ?? {};

    const directory : string = context.directory || process.cwd();
    const tsconfigDirectory : string = context.tsconfigDirectory || process.cwd();

    const dataSource = await findDataSource({
        directory,
        fileName: context.dataSourceName,
    });

    if (dataSource) {
        const options = await extendDataSourceOptions(
            dataSource.options,
            tsconfigDirectory,
        );

        return mergeDataSourceOptionsWithEnv(options);
    }

    const options = readDataSourceOptionsFromEnv();
    if (options) {
        return extendDataSourceOptions(options);
    }

    throw OptionsError.notFound();
}
