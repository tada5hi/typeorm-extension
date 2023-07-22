import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseCreateContext } from '../../../database';
import { createDatabase } from '../../../database';
import {
    adjustFilePath,
    parseFilePath,
    readTSConfig,
    resolveFilePath,
} from '../../../utils';
import type { TSConfig } from '../../../utils';

export interface DatabaseCreateArguments extends Arguments {
    preserveFilePaths: boolean,
    root: string;
    tsconfig: string,
    dataSource: string;
    synchronize: string;
    initialDatabase?: unknown;
}

export class DatabaseCreateCommand implements CommandModule {
    command = 'db:create';

    describe = 'Create database.';

    builder(args: Argv) {
        return args
            .option('preserveFilePaths', {
                default: false,
                type: 'boolean',
                describe: 'This option indicates if file paths should be preserved.',
            })
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Root directory of the project.',
            })
            .option('tsconfig', {
                alias: 'tc',
                default: 'tsconfig.json',
                describe: 'Name (or relative path incl. name) of the tsconfig file.',
            })
            .option('dataSource', {
                alias: 'd',
                default: 'data-source',
                describe: 'Name (or relative path incl. name) of the data-source file.',
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

    async handler(raw: Arguments) {
        const args : DatabaseCreateArguments = raw as DatabaseCreateArguments;

        let tsconfig : TSConfig | undefined;
        let sourcePath = resolveFilePath(args.dataSource, args.root);
        if (!args.preserveFilePaths) {
            tsconfig = await readTSConfig(resolveFilePath(args.root, args.tsconfig));
            sourcePath = await adjustFilePath(sourcePath, tsconfig);
        }

        const source = parseFilePath(sourcePath);

        consola.info(`DataSource Directory: ${source.directory}`);
        consola.info(`DataSource Name: ${source.name}`);

        const dataSourceOptions = await buildDataSourceOptions({
            directory: source.directory,
            dataSourceName: source.name,
            tsconfig,
            preserveFilePaths: args.preserveFilePaths,
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

        try {
            await createDatabase(context);
            consola.success('Created database.');
            process.exit(0);
        } catch (e) {
            consola.warn('Failed to create database.');
            consola.error(e);
            process.exit(1);
        }
    }
}
