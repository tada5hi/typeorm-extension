import { faker } from '@faker-js/faker';
import type { SaveOptions } from 'typeorm';
import type { SeederFactoryContext } from './type';
import { hasOwnProperty } from '../../utils';
import { useDataSource } from '../../data-source';
import { isPromise } from '../utils';

export class SeederFactory<O extends Record<string, any>, Meta = unknown> {
    public readonly context: SeederFactoryContext<O, Meta>;

    public meta: Meta | undefined;

    // --------------------------------------------------------------

    constructor(context: SeederFactoryContext<O, Meta>) {
        this.context = context;
    }

    // --------------------------------------------------------------

    public setMeta(value: Meta) {
        this.meta = value;

        return this;
    }

    // --------------------------------------------------------------

    public async make(params?: Partial<O>, save?: boolean) {
        const factoryFn = this.context.factoryFn(faker, this.meta);
        let entity : O;
        if (isPromise(factoryFn)) {
            entity = await this.resolve(await factoryFn, save);
        } else {
            entity = await this.resolve(factoryFn, save);
        }

        if (params) {
            const keys : (keyof O)[] = Object.keys(params);
            for (let i = 0; i < keys.length; i++) {
                entity[keys[i]] = (params as O)[keys[i]];
            }
        }

        return entity;
    }

    // --------------------------------------------------------------

    public async save(
        params?: Partial<O>,
        options?: SaveOptions,
    ) : Promise<O> {
        const dataSource = await useDataSource();

        const entity = await this.make(params, true);
        const entityManager = dataSource.getRepository(this.context.entity);

        return entityManager.save(entity, options);
    }

    public async saveMany(
        amount: number,
        params?: Partial<O>,
        options?: SaveOptions,
    ) : Promise<O[]> {
        const items : O[] = [];
        for (let i = 0; i < amount; i++) {
            const item = await this.save(params, options);
            items.push(item);
        }

        return items;
    }

    // --------------------------------------------------------------

    private async resolve(entity: O, save?: boolean) : Promise<O> {
        const keys = Object.keys(entity);
        for (let i = 0; i < keys.length; i++) {
            const key : keyof O = keys[i];
            const value : O[keyof O] = entity[key];

            if (!hasOwnProperty(entity, key)) {
                // eslint-disable-next-line no-continue
                continue;
            }

            if (
                typeof value === 'object' &&
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                value instanceof SeederFactory
            ) {
                if (save) {
                    entity[key] = await (value as SeederFactory<any>).save();
                } else {
                    entity[key] = await (value as SeederFactory<any>).make();
                }
            }

            if (
                value &&
                hasOwnProperty(value, 'then') &&
                typeof value.then === 'function'
            ) {
                entity[key] = await value;
            }
        }

        return entity;
    }
}
