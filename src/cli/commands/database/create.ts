import { defineCommand } from 'citty';
import process from 'node:process';
import { buildDataSourceOptions } from '../../../data-source';
import type { DatabaseCreateContextInput } from '../../../database';
import { createDatabase } from '../../../database';
import {
    adjustFilePath,
    parseFilePath,
    readTSConfig,
    resolveFilePath,
} from '../../../utils';
import type { TSConfig } from '../../../utils';
import { runWithExitCode } from '../../exit';
import { LOG_LEVEL_VALUES, createLogger, normalizeLogLevel } from '../../logger';

export function defineCLIDatabaseCreateCommand() {
    return defineCommand({
        meta: {
            name: 'create',
            description: 'Create database.',
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
            synchronize: {
                type: 'enum',
                alias: 's',
                default: 'yes',
                options: ['yes', 'no'],
                description: 'Create database schema for all entities.',
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
                logger.info('Creating database');

                let tsconfig : TSConfig | undefined;
                let sourcePath = resolveFilePath(args.dataSource, args.root);
                if (!args.preserveFilePaths) {
                    tsconfig = await readTSConfig(resolveFilePath(args.tsconfig, args.root));
                    sourcePath = await adjustFilePath(sourcePath, tsconfig);
                }

                const source = parseFilePath(sourcePath);

                logger.section('DataSource');
                const pad = 'directory'.length;
                logger.kv('directory', source.directory, pad);
                logger.kv('name', source.name, pad);

                const dataSourceOptions = await buildDataSourceOptions({
                    directory: source.directory,
                    dataSourceName: source.name,
                    tsconfig,
                    preserveFilePaths: args.preserveFilePaths,
                });

                const context : DatabaseCreateContextInput = {
                    ifNotExist: true,
                    options: dataSourceOptions,
                    synchronize: args.synchronize === 'yes',
                };

                if (
                    typeof args.initialDatabase === 'string' &&
                    args.initialDatabase !== ''
                ) {
                    context.initialDatabase = args.initialDatabase;
                }

                logger.blank();
                await createDatabase(context);
                logger.success('Created database.');
            });
        },
    });
}
