import { load } from 'locter';
import type { EntitySchema, ObjectType } from 'typeorm';
import { resolveFilePaths, resolveFilePatterns } from '../utils';
import { SeederFactoryManager } from './manager';
import type { FactoryCallback, SeederFactoryItem } from './type';

let instance : SeederFactoryManager | undefined;

export function useSeederFactoryManager() {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    instance = new SeederFactoryManager();

    return instance;
}

export function setSeederFactory<O extends Record<string, any>, Meta = unknown>(
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O, Meta>,
) : SeederFactoryItem {
    const manager = useSeederFactoryManager();
    return manager.set(entity, factoryFn);
}

export function useSeederFactory<O extends Record<string, any>>(
    entity: ObjectType<O> | EntitySchema<O>,
) {
    const manager = useSeederFactoryManager();
    return manager.get(entity);
}

export async function prepareSeederFactories(
    items: SeederFactoryItem[] | string[],
    root?: string,
) {
    let factoryFiles: string[] = [];
    const factoryConfigs: SeederFactoryItem[] = [];

    for (const value of items) {
        if (typeof value === 'string') {
            factoryFiles.push(value);
        } else {
            factoryConfigs.push(value);
        }
    }

    if (factoryFiles.length > 0) {
        factoryFiles = await resolveFilePatterns(factoryFiles, root);
        factoryFiles = resolveFilePaths(factoryFiles, root);

        for (const factoryFile of factoryFiles) {
            await load(factoryFile);
        }
    }

    if (factoryConfigs.length > 0) {
        const factoryManager = useSeederFactoryManager();

        for (const factoryConfig of factoryConfigs) {
            factoryManager.set(
                factoryConfig.entity,
                factoryConfig.factoryFn,
            );
        }
    }
}
