import type { DataSourceOptions } from 'typeorm';
import { ConnectionOptionsReader } from 'typeorm';
import type { DataSourceOptionsBuildContext } from './type';
import { setDefaultSeederOptions } from '../../seeder';
import {
    adjustFilePathsForDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
} from './utils';
import { findDataSource } from '../find';

export async function extendDataSourceOptions(
    options: DataSourceOptions,
    tsConfigDirectory?: string,
) : Promise<DataSourceOptions> {
    options = setDefaultSeederOptions(options);

    await adjustFilePathsForDataSourceOptions(options, { root: tsConfigDirectory });

    return options;
}

/**
 * Build DataSourceOptions from configuration.
 *
 * @deprecated
 * @param context
 */
export async function buildLegacyDataSourceOptions(
    context: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions> {
    const directory : string = context.directory || process.cwd();
    const tsconfigDirectory : string = context.tsconfigDirectory || process.cwd();

    const connectionOptionsReader = new ConnectionOptionsReader({
        root: directory,
        configName: context.configName,
    });

    const dataSourceOptions = await connectionOptionsReader.get(context.name || 'default');

    return extendDataSourceOptions(dataSourceOptions, tsconfigDirectory);
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

        if (context.experimental) {
            return mergeDataSourceOptionsWithEnv(options);
        }

        return options;
    }

    if (context.experimental) {
        const options = readDataSourceOptionsFromEnv();
        if (options) {
            return extendDataSourceOptions(options);
        }
    }

    return buildLegacyDataSourceOptions(context);
}
