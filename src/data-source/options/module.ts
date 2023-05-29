import type { DataSourceOptions } from 'typeorm';
import { useEnv } from '../../env';
import { OptionsError } from '../../errors';
import type { SeederOptions } from '../../seeder';
import { findDataSource } from '../find';
import type { DataSourceOptionsBuildContext } from './type';
import {
    adjustFilePathsForDataSourceOptions,
    mergeDataSourceOptionsWithEnv,
    readDataSourceOptionsFromEnv,
} from './utils';

export function extendDataSourceOptionsWithSeederOptions<T extends Partial<DataSourceOptions> & SeederOptions>(options: T): T {
    if (
        !Array.isArray(options.factories) ||
        options.factories.length === 0
    ) {
        let factories = useEnv('factories');
        if (factories.length === 0) {
            factories = ['src/database/factories/**/*{.ts,.js}'];
        }

        Object.assign(options, {
            factories,
        });
    }

    if (
        !Array.isArray(options.seeds) ||
        options.seeds.length === 0
    ) {
        let seeds = useEnv('seeds');
        if (seeds.length === 0) {
            seeds = ['src/database/seeds/**/*{.ts,.js}'];
        }

        Object.assign(options, {
            seeds,
        });
    }

    return options;
}

export async function extendDataSourceOptions(
    options: DataSourceOptions,
    tsConfigDirectory?: string,
) : Promise<DataSourceOptions> {
    options = extendDataSourceOptionsWithSeederOptions(options);

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
