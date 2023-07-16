import { getModuleExport, load } from 'locter';
import path from 'node:path';
import type { SeederFactoryItem } from '../factory';
import { useSeederFactoryManager } from '../factory';
import type { SeederConstructor, SeederPrepareElement } from '../type';
import { resolveFilePaths, resolveFilePatterns } from './file-path';

export async function prepareSeederFactories(
    items: SeederFactoryItem[] | string[],
) {
    let factoryFiles: string[] = [];
    const factoryConfigs: SeederFactoryItem[] = [];

    for (let i = 0; i < items.length; i++) {
        const value = items[i];
        if (typeof value === 'string') {
            factoryFiles.push(value);
        } else {
            factoryConfigs.push(value);
        }
    }

    if (factoryFiles.length > 0) {
        factoryFiles = await resolveFilePatterns(factoryFiles);
        factoryFiles = resolveFilePaths(factoryFiles);

        for (let i = 0; i < factoryFiles.length; i++) {
            await load(factoryFiles[i]);
        }
    }

    if (factoryConfigs.length > 0) {
        const factoryManager = useSeederFactoryManager();

        for (let i = 0; i < factoryConfigs.length; i++) {
            factoryManager.set(
                factoryConfigs[i].entity,
                factoryConfigs[i].factoryFn,
            );
        }
    }
}
export async function prepareSeederSeeds(
    input: SeederConstructor[] | string[],
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
        seedFiles = await resolveFilePatterns(seedFiles);
        seedFiles = resolveFilePaths(seedFiles);

        for (let i = 0; i < seedFiles.length; i++) {
            const moduleExports = await load(seedFiles[i]);
            const moduleDefault = getModuleExport(moduleExports);

            if (moduleDefault.value) {
                const item = moduleDefault.value as SeederConstructor;

                const fileName = path.basename(seedFiles[i]);
                const match = fileName.match(/^([0-9]{13,})-(.*)$/);
                if (match) {
                    items.push({
                        constructor: item,
                        timestamp: parseInt(match[1], 10),
                        fileName,
                    });
                } else {
                    items.push({
                        constructor: item,
                        fileName,
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
