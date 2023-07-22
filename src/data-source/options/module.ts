import { isObject } from 'locter';
import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../errors';
import { adjustFilePaths, readTSConfig } from '../../utils';
import type { TSConfig } from '../../utils';
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

    let tsconfig : TSConfig | undefined;
    if (!context.preserveFilePaths) {
        if (isObject(context.tsconfig)) {
            tsconfig = context.tsconfig;
        } else {
            tsconfig = await readTSConfig(context.tsconfig);
        }
    }

    const dataSource = await findDataSource({
        directory,
        fileName: context.dataSourceName,
        tsconfig,
    });

    if (dataSource) {
        if (context.preserveFilePaths) {
            return mergeDataSourceOptionsWithEnv(dataSource.options);
        }

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
        if (context.preserveFilePaths) {
            return options;
        }

        return adjustFilePaths(
            options,
            ['entities', 'migrations', 'subscribers'],
            tsconfig,
        );
    }

    throw OptionsError.notFound();
}
