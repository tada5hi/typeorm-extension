import { getFileNameExtension, removeFileNameExtension } from 'locter';
import fs from 'node:fs';
import path from 'node:path';
import { pascalCase } from 'pascal-case';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { consola } from 'consola';
import { buildSeederFileTemplate } from '../../../seeder';
import { isDirectory, parseFilePath } from '../../../utils';

export interface SeedCreateArguments extends Arguments {
    root: string;
    javascript: boolean;
    timestamp?: number,
    path: string
}

export class SeedCreateCommand implements CommandModule {
    command = 'seed:create <path>';

    describe = 'Create a seeder file';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Root directory of the project.',
            })
            .option('timestamp', {
                alias: 't',
                type: 'number',
                describe: 'Custom timestamp for the seeder name.',
            })
            .option('javascript', {
                alias: 'j',
                type: 'boolean',
                default: false,
                describe: 'Generate a seeder file for JavaScript instead of TypeScript.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as SeedCreateArguments;

        let timestamp : number;
        if (Number.isNaN(args.timestamp) || !args.timestamp) {
            timestamp = Date.now();
        } else {
            timestamp = args.timestamp;
        }

        const sourcePath = parseFilePath(args.path, args.root);

        const dirNameIsDirectory = await isDirectory(sourcePath.directory);
        if (!dirNameIsDirectory) {
            consola.warn(`The output directory ${sourcePath.directory} does not exist.`);
            process.exit(1);
        }

        const extension = args.javascript ?
            '.js' :
            '.ts';

        const nameExtension = getFileNameExtension(sourcePath.name);

        let fileName: string;
        if (nameExtension) {
            fileName = `${timestamp}-${sourcePath.name}`;
        } else {
            fileName = `${timestamp}-${sourcePath.name}${extension}`;
        }
        const filePath = sourcePath.directory + path.sep + fileName;
        const template = buildSeederFileTemplate(removeFileNameExtension(sourcePath.name), timestamp);

        consola.info(`Seed Directory: ${sourcePath.directory}`);
        consola.info(`Seed FileName: ${fileName}`);
        consola.info(`Seed Name: ${pascalCase(sourcePath.name)}`);

        try {
            await fs.promises.writeFile(filePath, template, { encoding: 'utf-8' });
        } catch (e) {
            consola.warn(`The seed could not be written to the path ${filePath}.`);
            process.exit(1);
        }

        process.exit(0);
    }
}
