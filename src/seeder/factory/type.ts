import type { Faker } from '@faker-js/faker';
import type { EntitySchema, ObjectType } from 'typeorm';

export type FactoryCallback<O, Meta = unknown> = (faker: Faker, meta: Meta) => O | Promise<O>;

export type SeederFactoryConfig = {
    factoryFn: FactoryCallback<any, any>,
    entity: ObjectType<any> | EntitySchema<any>
};

export type SeederFactoryContext<O, Meta = unknown> = {
    name: string,
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O, Meta | undefined>
};
