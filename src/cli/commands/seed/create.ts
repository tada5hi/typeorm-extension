import { consola } from 'consola';
import { defineCommand } from 'citty';
import { getFileNameExtension, removeFileNameExtension } from 'locter';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pascalCase } from 'pascal-case';
import { buildSeederFileTemplate } from '../../../seeder';
import { isDirectory, parseFilePath } from '../../../utils';

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
        },
        async run({ args }) {
            const parsedTimestamp = typeof args.timestamp === 'string' ?
                Number.parseInt(args.timestamp, 10) :
                Number.NaN;
            const timestamp = Number.isNaN(parsedTimestamp) ?
                Date.now() :
                parsedTimestamp;

            const sourcePath = parseFilePath(args.name, args.root);

            const dirNameIsDirectory = await isDirectory(sourcePath.directory);
            if (!dirNameIsDirectory) {
                consola.warn(`The output directory ${sourcePath.directory} does not exist.`);
                process.exit(1);
            }

            const extension = args.javascript ?
                '.js' :
                '.ts';

            const nameExtension = getFileNameExtension(sourcePath.name);
            const nameWithoutExtension = removeFileNameExtension(sourcePath.name);

            let fileName: string;
            if (nameExtension) {
                fileName = `${timestamp}-${sourcePath.name}`;
            } else {
                fileName = `${timestamp}-${sourcePath.name}${extension}`;
            }
            const filePath = sourcePath.directory + path.sep + fileName;
            const template = buildSeederFileTemplate(nameWithoutExtension, timestamp);

            consola.info(`Seed Directory: ${sourcePath.directory}`);
            consola.info(`Seed FileName: ${fileName}`);
            consola.info(`Seed Name: ${pascalCase(nameWithoutExtension)}`);

            try {
                await fs.promises.writeFile(filePath, template, { encoding: 'utf-8' });
            } catch {
                consola.warn(`The seed could not be written to the path ${filePath}.`);
                process.exit(1);
            }

            process.exit(0);
        },
    });
}
