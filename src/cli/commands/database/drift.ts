import { defineCommand } from 'citty';
import process from 'node:process';
import { buildDataSourceOptions } from '../../../data-source';
import { getSchemaDrift } from '../../../database';
import {
    PathResolverMode,
    createPathResolver,
    parseFilePath,
} from '../../../utils';
import { runWithExitCode } from '../../exit';
import { 
    CLIUserError, 
    LOG_LEVEL_VALUES, 
    createLogger, 
    normalizeLogLevel, 
} from '../../logger';

export function defineCLIDatabaseDriftCommand() {
    return defineCommand({
        meta: {
            name: 'drift',
            description: 'Assert that the database schema matches the entity metadata.',
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
            skipWithoutMigrations: {
                type: 'boolean',
                default: false,
                description: 'Report no drift if the data-source has no migrations registered.',
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
                logger.info('Checking schema drift');

                const pathResolver = createPathResolver({
                    root: args.root,
                    tsconfig: args.tsconfig,
                    mode: args.preserveFilePaths ?
                        PathResolverMode.PRESERVE :
                        PathResolverMode.AUTO,
                });

                const source = parseFilePath(await pathResolver.resolve(args.dataSource));

                logger.section('DataSource');
                const pad = 'directory'.length;
                logger.kv('directory', source.directory, pad);
                logger.kv('name', source.name, pad);

                const dataSourceOptions = await buildDataSourceOptions({
                    directory: source.directory,
                    dataSourceName: source.name,
                    tsconfig: await pathResolver.tsconfig(),
                    preserveFilePaths: args.preserveFilePaths,
                });

                logger.blank();

                const drift = await getSchemaDrift(dataSourceOptions, { skipWithoutMigrations: args.skipWithoutMigrations });

                if (!drift.exists) {
                    logger.success('No schema drift detected.');

                    return;
                }

                logger.section('Statements');
                for (let i = 0; i < drift.up.length; i++) {
                    const statement = drift.up[i];

                    logger.warn(
                        statement.parameters && statement.parameters.length > 0 ?
                            `${statement.query} -- ${JSON.stringify(statement.parameters)}` :
                            statement.query,
                    );
                }

                logger.blank();

                throw new CLIUserError(
                    `The database schema deviates from the entity metadata (${drift.up.length} statement(s) required to reconcile it).`,
                );
            });
        },
    });
}
