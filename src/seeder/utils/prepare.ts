import { load } from 'locter';
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

            let clazzConstructor : SeederConstructor | undefined;

            const exportKeys = Object.keys(moduleExports);
            for (let j = 0; j < exportKeys.length; j++) {
                const moduleExport = moduleExports[exportKeys[j]];
                if (
                    typeof moduleExport === 'function' &&
                    moduleExport.prototype
                ) {
                    clazzConstructor = moduleExport;
                }
            }

            if (clazzConstructor) {
                const fileName = path.basename(seedFiles[i]);
                const filePath = seedFiles[i];
                const match = fileName.match(/^([0-9]{13,})-(.*)$/);

                let timestamp : number | undefined;
                if (match) {
                    timestamp = parseInt(match[1], 10);
                }

                items.push({
                    constructor: clazzConstructor,
                    fileName,
                    filePath,
                    ...(timestamp ? { timestamp } : {}),
                });
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
