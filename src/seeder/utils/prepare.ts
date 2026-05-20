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

    for (const value of input) {
        if (typeof value === 'string') {
            seedFiles.push(value);
        } else {
            seedConstructors.push(value);
        }
    }

    if (seedFiles.length > 0) {
        seedFiles = await resolveFilePatterns(seedFiles, root);
        seedFiles = resolveFilePaths(seedFiles, root);

        for (const filePath of seedFiles) {
            const moduleExports = await load(filePath);

            let clazzConstructor : SeederConstructor | undefined;

            const exportKeys = Object.keys(moduleExports);
            for (const exportKey of exportKeys) {
                const moduleExport = moduleExports[exportKey];
                if (
                    typeof moduleExport === 'function' &&
                    moduleExport.prototype
                ) {
                    clazzConstructor = moduleExport;
                }
            }

            if (clazzConstructor) {
                const fileName = path.basename(filePath);
                const match = fileName.match(/^([0-9]{13,})-(.*)$/);

                let timestamp : number | undefined;
                if (match) {
                    timestamp = Number.parseInt(match[1], 10);
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
        for (const seedConstructor of seedConstructors) {
            items.push({ constructor: seedConstructor });
        }
    }

    return items;
}
