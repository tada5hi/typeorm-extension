import type { DataSource, EntitySchema, ObjectType } from 'typeorm';

export type FactoryCallback<O, Meta = unknown> = (meta: Meta) => O | Promise<O>;

export type SeederFactoryItem = {
    factoryFn: FactoryCallback<any, any>,
    entity: ObjectType<any> | EntitySchema<any>
};

export type SeederFactoryContext<O, Meta = unknown> = {
    name: string,
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O, Meta | undefined>,
    dataSource?: DataSource
};

export type SeederFactoryManagerContext = {
    items?: Record<string, SeederFactoryItem>,
    dataSource?: DataSource
};
