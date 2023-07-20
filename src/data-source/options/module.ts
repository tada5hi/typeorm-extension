import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../errors';
import { adjustFilePaths } from '../../utils';
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
    context?: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions> {
    context = context ?? {};

    const directory : string = context.directory || process.cwd();
    const tsconfig : string = context.tsconfig || process.cwd();

    const dataSource = await findDataSource({
        directory,
        fileName: context.dataSourceName,
    });

    if (dataSource) {
        const options = await adjustFilePaths(
            dataSource.options,
            [
                'entities',
                'migrations',
                'subscribers',
            ],
            tsconfig,
        );

        return mergeDataSourceOptionsWithEnv(options);
    }

    const options = readDataSourceOptionsFromEnv();
    if (options) {
        return adjustFilePaths(
            options,
            ['entities', 'migrations', 'subscribers'],
            tsconfig,
        );
    }

    throw OptionsError.notFound();
}
