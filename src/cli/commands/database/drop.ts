import {
    Arguments, ArgumentsCamelCase, Argv, CommandModule,
} from 'yargs';
import { ConnectionOptions } from 'typeorm';
import { buildConnectionOptions } from '../../../connection';
import { dropDatabase } from '../../../database';

export interface DatabaseDropArguments extends Arguments {
    root: string;
    connection: string;
    config: string;
}

export class DatabaseDropCommand implements CommandModule<any, DatabaseDropArguments> {
    command = 'db:drop';

    describe = 'Drop database.';

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
            });
    }

    async handler(args: ArgumentsCamelCase<DatabaseDropArguments>, exitProcess = true) {
        const connectionOptions: ConnectionOptions = await buildConnectionOptions({
            name: args.connection,
            root: args.root,
            configName: args.config,
            buildForCommand: true,
        });

        await dropDatabase({
            ifExist: true,
        }, connectionOptions);

        if (exitProcess) {
            process.exit(0);
        }
    }
}
