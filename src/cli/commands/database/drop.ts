import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseDropContext } from '../../../database';
import { dropDatabase } from '../../../database';
import {
    CodeTransformation, parseFilePath, resolveFilePath, setCodeTransformation,
} from '../../../utils';

export interface DatabaseDropArguments extends Arguments {
    codeTransformation: string,
    root: string;
    tsconfig: string,
    dataSource: string;
}

export class DatabaseDropCommand implements CommandModule {
    command = 'db:drop';

    describe = 'Drop database.';

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

        if (args.codeTransformation) {
            setCodeTransformation(args.codeTransformation);
        }

        const source = parseFilePath(args.dataSource, args.root);
        consola.info(`DataSource Directory: ${source.directory}`);
        consola.info(`DataSource Name: ${source.name}`);

        const tsconfig = resolveFilePath(args.root, args.tsconfig);
        const dataSourceOptions = await buildDataSourceOptions({
            directory: source.directory,
            dataSourceName: source.name,
            tsconfig,
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
