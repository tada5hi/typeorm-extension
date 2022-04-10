import { Arguments, Argv, CommandModule } from 'yargs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../../connection';
import { DatabaseCreateContext, createDatabase } from '../../../database';

export interface DatabaseCreateArguments extends Arguments {
    root: string;
    connection: 'default' | string;
    config: 'ormconfig' | string;
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
                describe: 'Path to your typeorm config file',
            })
            .option('connection', {
                alias: 'c',
                default: 'default',
                describe: 'Name of the connection on which run a query.',
            })
            .option('config', {
                alias: 'f',
                default: 'ormconfig',
                describe: 'Name of the file with connection configuration.',
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

        const dataSourceOptions = await buildDataSourceOptions({
            name: args.connection,
            configName: args.config,
            root: args.root,
            buildForCommand: true,
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

        await createDatabase(context);

        if (args.synchronize !== 'yes') {
            if (exitProcess) {
                process.exit(0);
            }

            return;
        }

        try {
            const connection = new DataSource(dataSourceOptions);
            await connection.initialize();
            await connection.synchronize(false);

            if (exitProcess) {
                await connection.destroy();
                process.exit(0);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            if (exitProcess) {
                process.exit(1);
            }
        }
    }
}
