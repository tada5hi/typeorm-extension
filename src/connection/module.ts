import { ConnectionOptionsReader, DataSourceOptions } from 'typeorm';
import { ConnectionBuilderOptions } from './type';
import { ConnectionWithSeederOptions, createDefaultSeederOptions } from '../seeder';
import { modifyConnectionOptionsForRuntimeEnvironment } from './utils';
import { readTsConfig } from '../utils/tsconfig';

export async function buildDataSourceOptions(
    options?: ConnectionBuilderOptions,
) : Promise<ConnectionWithSeederOptions> {
    options = options ?? {};

    const root : string = options.root || process.cwd();

    const connectionOptionsReader = new ConnectionOptionsReader({
        root,
        configName: options.configName,
    });

    let connectionOptions : ConnectionWithSeederOptions = await connectionOptionsReader.get(options.name || 'default');

    /* istanbul ignore next */
    if (options.buildForCommand) {
        Object.assign(connectionOptions, {
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ['query', 'error', 'schema'],
        } as DataSourceOptions);
    }

    connectionOptions = createDefaultSeederOptions(connectionOptions);

    let { compilerOptions } = await readTsConfig(options.tsConfigDirectory || root);
    compilerOptions = compilerOptions || {};

    modifyConnectionOptionsForRuntimeEnvironment(connectionOptions, {
        dist: compilerOptions.outDir,
    });

    return connectionOptions;
}
