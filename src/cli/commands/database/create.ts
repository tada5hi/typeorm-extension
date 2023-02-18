import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseCreateContext } from '../../../database';
import { createDatabase } from '../../../database';
import { CodeTransformation, setCodeTransformation } from '../../../utils';

export interface DatabaseCreateArguments extends Arguments {
    codeTransformation: string,
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

        if (args.codeTransformation) {
            setCodeTransformation(args.codeTransformation);
        }

        const dataSourceOptions = await buildDataSourceOptions({
            name: args.connection,
            configName: args.config,
            directory: args.root,
            dataSourceName: args.dataSource,
        });

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
