import type { EntitySchema, ObjectType } from 'typeorm';
import type { FactoryCallback, SeederFactoryConfig } from './type';
import { getEntityName, hasOwnProperty } from '../../utils';
import { SeederFactory } from './module';

export class SeederFactoryManager {
    public readonly items : Record<string, SeederFactoryConfig> = {};

    set<O extends Record<string, any>, Meta = unknown>(
        entity: ObjectType<O> | EntitySchema<O>,
        factoryFn: FactoryCallback<O, Meta>,
    ) : SeederFactoryConfig {
        const name = getEntityName(entity);

        this.items[name] = {
            factoryFn,
            entity,
        };

        return this.items[name];
    }

    get<O extends Record<string, any>, Meta = unknown>(
        entity: ObjectType<O> | EntitySchema<O>,
    ) : SeederFactory<O, Meta> {
        const name = getEntityName(entity);

        if (!hasOwnProperty(this.items, name)) {
            throw new Error(`No seeder factory is registered for the entity: ${name}`);
        }

        return new SeederFactory({
            factoryFn: this.items[name].factoryFn,
            entity,
            name,
        });
    }
}
