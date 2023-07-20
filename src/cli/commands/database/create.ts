import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseCreateContext } from '../../../database';
import { createDatabase } from '../../../database';
import {
    CodeTransformation,
    parseFilePath,
    resolveFilePath,
    setCodeTransformation,
} from '../../../utils';

export interface DatabaseCreateArguments extends Arguments {
    codeTransformation: string,
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
                describe: 'Name (incl. relative path) of the tsconfig file.',
            })
            .option('dataSource', {
                alias: 'd',
                default: 'data-source',
                describe: 'Name (incl. relative path) of the data-source file.',
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
