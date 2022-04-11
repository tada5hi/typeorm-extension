import { ConnectionOptionsReader, DataSourceOptions } from 'typeorm';
import { DataSourceOptionsBuildContext } from './type';
import { setDefaultSeederOptions } from '../../seeder';
import { modifyDataSourceOptionsForRuntimeEnvironment } from './utils';
import { readTsConfig } from '../../utils/tsconfig';

export async function buildDataSourceOptions(
    context?: DataSourceOptionsBuildContext,
) : Promise<DataSourceOptions> {
    context = context ?? {};

    const root : string = context.root || process.cwd();

    const connectionOptionsReader = new ConnectionOptionsReader({
        root,
        configName: context.configName,
    });

    let dataSourceOptions = await connectionOptionsReader.get(context.name || 'default');

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

    dataSourceOptions = setDefaultSeederOptions(dataSourceOptions);

    let { compilerOptions } = await readTsConfig(context.tsConfigDirectory || root);
    compilerOptions = compilerOptions || {};

    modifyDataSourceOptionsForRuntimeEnvironment(dataSourceOptions, {
        dist: compilerOptions.outDir,
    });

    return dataSourceOptions;
}
