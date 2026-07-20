import { defineCommand } from 'citty';
import { isDirectory, parseFilePath, removeFileNameExtension  } from '../../../utils';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pascalCase } from 'pascal-case';
import { buildSeederFileName, buildSeederFileTemplate } from '../../../seeder';
import { runWithExitCode } from '../../exit';
import { 
    CLIUserError, 
    LOG_LEVEL_VALUES, 
    createLogger, 
    normalizeLogLevel, 
} from '../../logger';

export function defineCLISeedCreateCommand() {
    return defineCommand({
        meta: {
            name: 'create',
            description: 'Create a seeder file.',
        },
        args: {
            root: {
                type: 'string',
                alias: 'r',
                default: process.cwd(),
                description: 'Root directory of the project.',
            },
            timestamp: {
                type: 'string',
                alias: 't',
                description: 'Custom timestamp for the seeder name.',
            },
            javascript: {
                type: 'boolean',
                alias: 'j',
                default: false,
                description: 'Generate a seeder file for JavaScript instead of TypeScript.',
            },
            name: {
                type: 'string',
                alias: 'n',
                required: true,
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
                logger.info('Creating seeder file');

                const parsedTimestamp = typeof args.timestamp === 'string' ?
                    Number.parseInt(args.timestamp, 10) :
                    Number.NaN;
                const timestamp = Number.isNaN(parsedTimestamp) ?
                    Date.now() :
                    parsedTimestamp;

                const sourcePath = parseFilePath(args.name, args.root);

                const dirNameIsDirectory = await isDirectory(sourcePath.directory);
                if (!dirNameIsDirectory) {
                    throw new CLIUserError(
                        `The output directory ${sourcePath.directory} does not exist.`,
                    );
                }

                const nameWithoutExtension = removeFileNameExtension(sourcePath.name);

                const fileName = buildSeederFileName(sourcePath.name, timestamp, { javascript: args.javascript });
                const filePath = path.join(sourcePath.directory, fileName);
                const template = buildSeederFileTemplate(nameWithoutExtension, timestamp);

                logger.section('Seed');
                const pad = 'directory'.length;
                logger.kv('directory', sourcePath.directory, pad);
                logger.kv('fileName', fileName, pad);
                logger.kv('name', pascalCase(nameWithoutExtension), pad);

                try {
                    await fs.promises.writeFile(filePath, template, { encoding: 'utf-8' });
                } catch {
                    throw new CLIUserError(
                        `The seed could not be written to the path ${filePath}.`,
                    );
                }

                logger.blank();
                logger.success('Created seeder file.');
            });
        },
    });
}
