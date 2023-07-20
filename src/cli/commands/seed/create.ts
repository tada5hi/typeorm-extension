import fs from 'node:fs';
import path from 'node:path';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { consola } from 'consola';
import { buildSeederFileTemplate } from '../../../seeder';
import { isDirectory } from '../../../utils';

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
                describe: 'Custom timestamp for the seeder name',
            })
            .option('javascript', {
                alias: 'j',
                type: 'boolean',
                default: false,
                describe: 'Generate a seeder file for Javascript instead of Typescript',
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

        const fullPath = args.path.startsWith('/') ?
            args.path :
            path.resolve(args.root, args.path);
        const dirName = path.dirname(fullPath);
        const dirNameIsDirectory = await isDirectory(dirName);
        if (!dirNameIsDirectory) {
            consola.warn(`The output directory ${dirName} does not exist.`);
            process.exit(1);
        }

        const extension = args.javascript ? '.js' : '.ts';
        const name = path.basename(fullPath);
        const filename = `${timestamp}-${name}${extension}`;
        const filePath = dirName + path.sep + filename;
        const template = buildSeederFileTemplate(name, timestamp);

        try {
            await fs.promises.writeFile(filePath, template, { encoding: 'utf-8' });
        } catch (e) {
            consola.warn(`The file could not be written to the path ${filePath}`);
            process.exit(1);
        }

        process.exit(0);
    }
}
