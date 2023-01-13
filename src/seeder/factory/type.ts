import { Faker } from '@faker-js/faker';
import { EntitySchema, ObjectType } from 'typeorm';

export type FactoryCallback<O> = (faker: Faker, meta: never) => O | Promise<O>;

export type SeederFactoryConfig = {
    factoryFn: FactoryCallback<any>,
    entity: ObjectType<any> | EntitySchema<any>
};

export type SeederFactoryContext<O> = {
    name: string,
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O>
};
