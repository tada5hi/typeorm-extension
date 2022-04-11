import { Arguments, Argv, CommandModule } from 'yargs';
import { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from '../../../data-source';
import { dropDatabase } from '../../../database';
import { findDataSource } from '../../../data-source/utils';

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
            });
    }

    async handler(raw: Arguments, exitProcess = true) {
        const args : DatabaseDropArguments = raw as DatabaseDropArguments;

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

        await dropDatabase({
            ifExist: true,
            options: dataSourceOptions,
        });

        if (exitProcess) {
            process.exit(0);
        }
    }
}
