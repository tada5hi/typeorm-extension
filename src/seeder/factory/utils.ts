import type { EntitySchema, ObjectType } from 'typeorm';
import { SeederFactoryManager } from './manager';
import type { FactoryCallback, SeederFactoryConfig } from './type';

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
) : SeederFactoryConfig {
    const manager = useSeederFactoryManager();
    return manager.set(entity, factoryFn);
}

export function useSeederFactory<O extends Record<string, any>>(
    entity: ObjectType<O> | EntitySchema<O>,
) {
    const manager = useSeederFactoryManager();
    return manager.get(entity);
}
