import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseDropContext } from '../../../database';
import { dropDatabase } from '../../../database';

export interface DatabaseDropArguments extends Arguments {
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
    dataSource: 'data-source' | string;
}

export class DatabaseDropCommand implements CommandModule {
    command = 'db:drop';

    describe = 'Drop database.';

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
            .option('initialDatabase', {
                describe: 'Specify the initial database to connect to.',
            });
    }

    async handler(raw: Arguments, exitProcess = true) {
        const args : DatabaseDropArguments = raw as DatabaseDropArguments;

        const dataSourceOptions = await buildDataSourceOptions({
            name: args.connection,
            configName: args.config,
            directory: args.root,
            dataSourceName: args.dataSource,
        });

        const context : DatabaseDropContext = {
            ifExist: true,
            options: dataSourceOptions,
        };

        if (
            typeof args.initialDatabase === 'string' &&
            args.initialDatabase !== ''
        ) {
            context.initialDatabase = args.initialDatabase;
        }

        await dropDatabase(context);

        if (exitProcess) {
            process.exit(0);
        }
    }
}
