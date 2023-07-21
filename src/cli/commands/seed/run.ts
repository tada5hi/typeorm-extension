import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions, setDataSourceOptions, useDataSource } from '../../../data-source';
import { SeederExecutor } from '../../../seeder';
import {
    CodeTransformation,
    parseFilePath, resolveFilePath,
    setCodeTransformation,
} from '../../../utils';

export interface SeedRunArguments extends Arguments {
    codeTransformation: string,
    root: string;
    tsconfig: string,
    dataSource: string;
    name?: string,
}

export class SeedRunCommand implements CommandModule {
    command = 'seed:run';

    describe = 'Populate the database with an initial data set or generated data by a factory.';

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
            .option('name', {
                alias: 'n',
                describe: 'Name (or relative path incl. name) of the seeder.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as SeedRunArguments;

        if (args.codeTransformation) {
            setCodeTransformation(args.codeTransformation);
        }

        const source = parseFilePath(args.dataSource, args.root);
        consola.info(`DataSource Directory: ${source.directory}`);
        consola.info(`DataSource Name: ${source.name}`);

        const tsconfig = resolveFilePath(args.root, args.tsconfig);
        const dataSourceOptions = await buildDataSourceOptions({
            dataSourceName: source.name,
            directory: source.directory,
            tsconfig,
        });

        setDataSourceOptions(dataSourceOptions);

        if (args.name) {
            consola.info(`Seed Name: ${args.name}`);
        }

        const dataSource = await useDataSource();
        const executor = new SeederExecutor(dataSource, {
            root: args.root,
            tsconfig,
        });

        await executor.execute({ seedName: args.name });

        process.exit(0);
    }
}
