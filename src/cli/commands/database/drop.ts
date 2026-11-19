import { defineCommand } from 'citty';
import process from 'node:process';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseDropContext } from '../../../database';
import { dropDatabase } from '../../../database';
import { buildCLIDataSourceContext } from '../../data-source';
import { runWithExitCode } from '../../exit';
import { LOG_LEVEL_VALUES, createLogger, normalizeLogLevel } from '../../logger';

export function defineCLIDatabaseDropCommand() {
    return defineCommand({
        meta: {
            name: 'drop',
            description: 'Drop database.',
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
            initialDatabase: {
                type: 'string',
                description: 'Specify the initial database to connect to.',
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
                logger.info('Dropping database');

                const { context: dataSourceContext } = await buildCLIDataSourceContext({
                    dataSource: args.dataSource,
                    root: args.root,
                    tsconfig: args.tsconfig,
                    preserveFilePaths: args.preserveFilePaths,
                });


                logger.section('DataSource');

                const pad = 'directory'.length;

                logger.kv('directory', dataSourceContext.directory, pad);
                logger.kv('name', dataSourceContext.dataSourceName, pad);

                const dataSourceOptions = await buildDataSourceOptions(dataSourceContext);

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

                logger.blank();
                await dropDatabase(context);
                logger.success('Dropped database.');
            });
        },
    });
}
