import { defineCommand } from 'citty';
import process from 'node:process';
import { buildDataSourceOptions, setDataSourceOptions, useDataSource } from '../../../data-source';
import { SeederExecutor } from '../../../seeder';
import { buildCLIDataSourceContext } from '../../data-source';
import { runWithExitCode } from '../../exit';
import { LOG_LEVEL_VALUES, createLogger, normalizeLogLevel } from '../../logger';

export function defineCLISeedRunCommand() {
    return defineCommand({
        meta: {
            name: 'run',
            description: 'Populate the database with an initial data set or generated data by a factory.',
        },
        args: {
            preserveFilePaths: {
                type: 'boolean',
                default: false,
                description: 'This option indicates if file paths should be preserved.',
            },
            root: {
                type: 'string',
                alias: 'r',
                default: process.cwd(),
                description: 'Root directory of the project.',
            },
            tsconfig: {
                type: 'string',
                alias: 'tc',
                default: 'tsconfig.json',
                description: 'Name (or relative path incl. name) of the tsconfig file.',
            },
            dataSource: {
                type: 'string',
                alias: 'd',
                default: 'data-source',
                description: 'Name (or relative path incl. name) of the data-source file.',
            },
            name: {
                type: 'string',
                alias: 'n',
                description: 'Name (or relative path incl. name) of the seeder.',
            },
            'log-level': {
                type: 'string',
                description: 'Logger verbosity.',
                valueHint: LOG_LEVEL_VALUES.join('|'),
                options: LOG_LEVEL_VALUES as string[],
            },
        },
        async run({ args }) {
            const logger = createLogger(normalizeLogLevel(args['log-level'] as string | undefined));

            await runWithExitCode(logger, async () => {
                logger.info('Running seeders');

                const { pathResolver, context: dataSourceContext } = await buildCLIDataSourceContext({
                    dataSource: args.dataSource,
                    root: args.root,
                    tsconfig: args.tsconfig,
                    preserveFilePaths: args.preserveFilePaths,
                });

                let { name } = args;

                if (name) {
                    name = await pathResolver.transform(name);
                }


                logger.section('DataSource');

                const dsPad = 'directory'.length;

                logger.kv('directory', dataSourceContext.directory, dsPad);
                logger.kv('name', dataSourceContext.dataSourceName, dsPad);

                const dataSourceOptions = await buildDataSourceOptions(dataSourceContext);

                setDataSourceOptions(dataSourceOptions);

                if (name) {
                    logger.section('Seed');
                    logger.kv('name', name, 'name'.length);
                }

                const dataSource = await useDataSource();
                const executor = new SeederExecutor(dataSource, {
                    root: args.root,
                    tsconfig: await pathResolver.tsconfig(),
                    preserveFilePaths: args.preserveFilePaths,
                });

                logger.blank();
                await executor.execute({ seedName: name });
                logger.success('Executed seeders.');
            });
        },
    });
}
