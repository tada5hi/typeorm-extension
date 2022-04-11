import { Arguments, Argv, CommandModule } from 'yargs';
import { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from '../../../data-source';
import { DatabaseCreateContext, createDatabase } from '../../../database';
import { findDataSource } from '../../../data-source/utils';

export interface DatabaseCreateArguments extends Arguments {
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
    dataSource: 'data-source' | string;
    synchronize: string;
    initialDatabase?: unknown;
}

export class DatabaseCreateCommand implements CommandModule {
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
            .option('synchronize', {
                alias: 's',
                default: 'yes',
                describe: 'Create database schema for all entities.',
                choices: ['yes', 'no'],
            })
            .option('initialDatabase', {
                describe: 'Specify the initial database to connect to.',
            });
    }

    async handler(raw: Arguments, exitProcess = true) {
        const args : DatabaseCreateArguments = raw as DatabaseCreateArguments;

        let dataSourceOptions : DataSourceOptions;
        const dataSource = await findDataSource({
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

        const context : DatabaseCreateContext = {
            ifNotExist: true,
            options: dataSourceOptions,
        };

        if (
            typeof args.initialDatabase === 'string' &&
            args.initialDatabase !== ''
        ) {
            context.initialDatabase = args.initialDatabase;
        }

        context.synchronize = args.synchronize === 'yes';

        await createDatabase(context);

        if (exitProcess) {
            process.exit(0);
        }
    }
}
