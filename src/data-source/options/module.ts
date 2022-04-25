import { ConnectionOptionsReader, DataSourceOptions } from 'typeorm';
import { DataSourceOptionsBuildContext } from './type';
import { setDefaultSeederOptions } from '../../seeder';
import { modifyDataSourceOptionsForRuntimeEnvironment } from './utils';
import { readTsConfig } from '../../utils/tsconfig';
import { findDataSource } from '../find';

export async function extendDataSourceOptions(
    options: DataSourceOptions,
    tsConfigDirectory?: string,
) : Promise<DataSourceOptions> {
    options = setDefaultSeederOptions(options);

    let { compilerOptions } = await readTsConfig(tsConfigDirectory || process.cwd());
    compilerOptions = compilerOptions || {};

    modifyDataSourceOptionsForRuntimeEnvironment(options, {
        dist: compilerOptions.outDir,
    });

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
        return extendDataSourceOptions(
            dataSource.options,
            tsconfigDirectory,
        );
    }

    return buildLegacyDataSourceOptions(context);
}
