import { consola } from 'consola';
import path from 'node:path';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions, setDataSourceOptions, useDataSource } from '../../../data-source';
import { SeederExecutor } from '../../../seeder/executor';
import { CodeTransformation, setCodeTransformation } from '../../../utils';

export interface SeedRunArguments extends Arguments {
    codeTransformation: string,
    root: string;
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
            .option('dataSource', {
                alias: 'd',
                default: 'data-source',
                describe: 'Name or relative path of the data-source file.',
            })
            .option('name', {
                alias: 'n',
                describe: 'Specify the seed class to run.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as SeedRunArguments;

        if (args.codeTransformation) {
            setCodeTransformation(args.codeTransformation);
        }

        const fullPath = args.dataSource.startsWith('/') ?
            args.dataSource :
            path.resolve(args.root, args.dataSource);

        const dirPath = path.dirname(fullPath);
        const name = path.basename(fullPath);

        consola.info(`Looking for ${name} in directory ${dirPath}`);

        const dataSourceOptions = await buildDataSourceOptions({
            dataSourceName: name,
            directory: dirPath,
            tsconfigDirectory: args.root,
        });

        setDataSourceOptions(dataSourceOptions);

        const dataSource = await useDataSource();
        const executor = new SeederExecutor(dataSource);
        await executor.execute({ seedName: args.name });

        process.exit(0);
    }
}
