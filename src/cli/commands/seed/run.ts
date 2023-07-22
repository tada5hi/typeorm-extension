import { consola } from 'consola';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { buildDataSourceOptions, setDataSourceOptions, useDataSource } from '../../../data-source';
import { SeederExecutor } from '../../../seeder';
import {
    adjustFilePath,
    parseFilePath,
    readTSConfig,
    resolveFilePath,
} from '../../../utils';
import type { TSConfig } from '../../../utils';

export interface SeedRunArguments extends Arguments {
    preserveFilePaths: boolean,
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
            .option('name', {
                alias: 'n',
                describe: 'Name (or relative path incl. name) of the seeder.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as SeedRunArguments;

        let tsconfig : TSConfig | undefined;
        let sourcePath = resolveFilePath(args.dataSource, args.root);
        if (!args.preserveFilePaths) {
            tsconfig = await readTSConfig(args.root);
            sourcePath = await adjustFilePath(sourcePath, tsconfig);
            args.name = await adjustFilePath(args.name, tsconfig);
        }

        const source = parseFilePath(sourcePath);

        consola.info(`DataSource Directory: ${source.directory}`);
        consola.info(`DataSource Name: ${source.name}`);

        const dataSourceOptions = await buildDataSourceOptions({
            dataSourceName: source.name,
            directory: source.directory,
            tsconfig,
            preserveFilePaths: args.preserveFilePaths,
        });

        setDataSourceOptions(dataSourceOptions);

        if (args.name) {
            consola.info(`Seed Name: ${args.name}`);
        }

        const dataSource = await useDataSource();
        const executor = new SeederExecutor(dataSource, {
            root: args.root,
            tsconfig,
            preserveFilePaths: args.preserveFilePaths,
        });

        await executor.execute({ seedName: args.name });

        process.exit(0);
    }
}
