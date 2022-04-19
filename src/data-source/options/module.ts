import { ConnectionOptionsReader, DataSourceOptions } from 'typeorm';
import { DataSourceOptionsBuildContext } from './type';
import { setDefaultSeederOptions } from '../../seeder';
import { modifyDataSourceOptionsForRuntimeEnvironment } from './utils';
import { readTsConfig } from '../../utils/tsconfig';

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

export async function buildDataSourceOptions(
    context?: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions> {
    context = context ?? {};

    const root : string = context.root || process.cwd();

    const connectionOptionsReader = new ConnectionOptionsReader({
        root,
        configName: context.configName,
    });

    const dataSourceOptions = await connectionOptionsReader.get(context.name || 'default');

    /* istanbul ignore next */
    if (context.buildForCommand) {
        Object.assign(dataSourceOptions, {
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ['query', 'error', 'schema'],
        } as DataSourceOptions);
    }

    return extendDataSourceOptions(dataSourceOptions, context.tsConfigDirectory || root);
}
