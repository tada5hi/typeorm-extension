import { getModuleExport, load } from 'locter';
import path from 'node:path';
import type { SeederConstructor, SeederPrepareElement } from '../type';
import { resolveFilePaths, resolveFilePatterns } from './file-path';

export async function prepareSeederSeeds(
    input: SeederConstructor[] | string[],
    root?: string,
): Promise<SeederPrepareElement[]> {
    const items: SeederPrepareElement[] = [];

    let seedFiles: string[] = [];
    const seedConstructors: SeederConstructor[] = [];

    for (let i = 0; i < input.length; i++) {
        const value = input[i];
        if (typeof value === 'string') {
            seedFiles.push(value);
        } else {
            seedConstructors.push(value);
        }
    }

    if (seedFiles.length > 0) {
        seedFiles = await resolveFilePatterns(seedFiles, root);
        seedFiles = resolveFilePaths(seedFiles, root);

        for (let i = 0; i < seedFiles.length; i++) {
            const moduleExports = await load(seedFiles[i]);
            const moduleDefault = getModuleExport(moduleExports);

            if (moduleDefault.value) {
                const item = moduleDefault.value as SeederConstructor;

                const fileName = path.basename(seedFiles[i]);
                const filePath = seedFiles[i];
                const match = fileName.match(/^([0-9]{13,})-(.*)$/);
                if (match) {
                    items.push({
                        constructor: item,
                        timestamp: parseInt(match[1], 10),
                        fileName,
                        filePath,
                    });
                } else {
                    items.push({
                        constructor: item,
                        fileName,
                        filePath,
                    });
                }
            }
        }
    }

    if (seedConstructors.length > 0) {
        for (let i = 0; i < seedConstructors.length; i++) {
            items.push({
                constructor: seedConstructors[i],
            });
        }
    }

    return items;
}
