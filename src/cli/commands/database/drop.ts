import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseDropContext } from '../../../database';
import { dropDatabase } from '../../../database';
import {
    adjustFilePath,
    parseFilePath,
    resolveFilePath,
} from '../../../utils';
import type { TSConfig } from '../../../utils/tsconfig';
import { readTSConfig } from '../../../utils/tsconfig';

export interface DatabaseDropArguments extends Arguments {
    preserveFilePaths: boolean,
    root: string;
    tsconfig: string,
    dataSource: string;
}

export class DatabaseDropCommand implements CommandModule {
    command = 'db:drop';

    describe = 'Drop database.';

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
            .option('initialDatabase', {
                describe: 'Specify the initial database to connect to.',
            });
    }

    async handler(raw: Arguments) {
        const args : DatabaseDropArguments = raw as DatabaseDropArguments;

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

        try {
            await dropDatabase(context);
            consola.success('Dropped database.');
            process.exit(0);
        } catch (e) {
            consola.warn('Failed to drop database.');
            consola.error(e);
            process.exit(1);
        }
    }
}
