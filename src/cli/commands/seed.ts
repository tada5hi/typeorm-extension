import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions, setDataSourceOptions, useDataSource } from '../../data-source';
import { runSeeders } from '../../seeder';
import { CodeTransformation, setCodeTransformation } from '../../utils';

export interface DatabaseSeedArguments extends Arguments {
    codeTransformation: string,
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
    dataSource: 'data-source' | string;
    seed: undefined | string,
}

export class SeedCommand implements CommandModule {
    command = 'seed';

    describe = 'Populate the database with an initial data set or generated data by a factory.';

    builder(args: Argv) {
        return args
            .option('codeTransformation', {
                default: CodeTransformation.NONE,
                choices: [CodeTransformation.NONE, CodeTransformation.JUST_IN_TIME],
                describe: 'This option specifies how the code is transformed and how the library should behave as a result.',
            })
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

        if (args.codeTransformation) {
            setCodeTransformation(args.codeTransformation);
        }

        const dataSourceOptions = await buildDataSourceOptions({
            name: args.connection,
            configName: args.config,
            directory: args.root,
            dataSourceName: args.dataSource,
        });

        setDataSourceOptions(dataSourceOptions);

        const dataSource = await useDataSource();

        await runSeeders(dataSource, {
            seedName: args.seed,
        });

        if (exitProcess) {
            process.exit(0);
        }
    }
}
