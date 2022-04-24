import { Arguments, Argv, CommandModule } from 'yargs';
import { DataSourceOptions } from 'typeorm';
import {
    runSeeders,
} from '../../../seeder';
import {
    buildDataSourceOptions,
    extendDataSourceOptions,
    findDataSource,
    setDataSourceOptions,
    useDataSource,
} from '../../../data-source';

export interface DatabaseSeedArguments extends Arguments {
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
    dataSource: 'data-source' | string;
    seed: undefined | string,
}

export class DatabaseSeedCommand implements CommandModule {
    command = 'db:create';

    describe = 'Create database.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to the data-source / config file.',
            })
            .option('connection', {
                alias: 'c',
                default: 'default',
                describe: 'Name of the connection on which run a query.',
                deprecated: true,
            })
            .option('config', {
                alias: 'f',
                default: 'ormconfig',
                describe: 'Name of the file with the data-source configuration.',
                deprecated: true,
            })
            .option('dataSource', {
                alias: 'd',
                default: 'data-source',
                describe: 'Name of the file with the data-source.',
            })
            .option('seed', {
                alias: 's',
                describe: 'Specify the seed class to run.',
            });
    }

    async handler(raw: Arguments, exitProcess = true) {
        const args : DatabaseSeedArguments = raw as DatabaseSeedArguments;

        let dataSourceOptions : DataSourceOptions;
        let dataSource = await findDataSource({
            directory: args.root,
            fileName: args.dataSource,
        });

        if (dataSource) {
            dataSourceOptions = dataSource.options;
        }

        if (!dataSourceOptions) {
            dataSourceOptions = await buildDataSourceOptions({
                name: args.connection,
                configName: args.config,
                root: args.root,
                buildForCommand: true,
            });
        }

        dataSourceOptions = await extendDataSourceOptions(dataSourceOptions);

        setDataSourceOptions(dataSourceOptions);

        dataSource = await useDataSource();
        await runSeeders(dataSource, {
            seedName: args.seed,
        });

        if (exitProcess) {
            process.exit(0);
        }
    }
}
