import type { DataSource, EntitySchema, ObjectType } from 'typeorm';
import type { FactoryCallback, SeederFactoryItem, SeederFactoryManagerContext } from './type';
import { getEntityName, hasOwnProperty } from '../../utils';
import { SeederFactory } from './module';

export class SeederFactoryManager {
    public readonly items : Record<string, SeederFactoryItem>;

    public readonly dataSource : DataSource | undefined;

    constructor(context: SeederFactoryManagerContext = {}) {
        this.items = context.items || {};
        this.dataSource = context.dataSource;
    }

    set<O extends Record<string, any>, Meta = unknown>(
        entity: ObjectType<O> | EntitySchema<O>,
        factoryFn: FactoryCallback<O, Meta>,
    ) : SeederFactoryItem {
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
            dataSource: this.dataSource,
        });
    }
}
