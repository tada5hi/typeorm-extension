import { markInstanceof } from '@ebec/core';
import { hasOwnProperty, isPromise } from '../../utils';
import type { SaveOptions } from 'typeorm';
import { useDataSource } from '../../data-source';
import { isSeederFactory } from './check';
import { SEEDER_FACTORY_INSTANCE } from './constants';
import type { ISeederFactory, SeederFactoryContext } from './types';

/**
 * Any value with a callable then (native promises inherit it; functions
 * and arrays may carry one).
 */
function isThenable(input: unknown) : input is PromiseLike<unknown> {
    return (typeof input === 'object' || typeof input === 'function') &&
        input !== null &&
        typeof (input as { then?: unknown }).then === 'function';
}

export class SeederFactory<O extends Record<string, any>, Meta = unknown> implements ISeederFactory<O, Meta> {
    public readonly context: SeederFactoryContext<O, Meta>;

    public meta: Meta | undefined;

    // --------------------------------------------------------------

    constructor(context: SeederFactoryContext<O, Meta>) {
        markInstanceof(this, SEEDER_FACTORY_INSTANCE);

        this.context = context;
    }

    // --------------------------------------------------------------

    public setMeta(value: Meta) {
        this.meta = value;

        return this;
    }

    // --------------------------------------------------------------

    public async make(params?: Partial<O>, save?: boolean) {
        const factoryFn = this.context.factoryFn(this.meta);
        const entity : O = isPromise(factoryFn) ?
            await factoryFn :
            factoryFn;

        // Apply params before resolving, so a nested factory of an
        // overridden key never runs (and never saves a row).
        if (params) {
            const keys : (keyof O)[] = Object.keys(params);

            for (const key of keys) {
                const value : unknown = entity[key];

                // the overridden value is unused: a rejection of it must not
                // end up as an unhandled rejection.
                if (isThenable(value)) {
                    Promise.resolve(value).catch(() => undefined);
                }

                entity[key] = (params as O)[key];
            }
        }

        return this.resolve(entity, save);
    }

    // --------------------------------------------------------------

    public async save(
        params?: Partial<O>,
        options?: SaveOptions,
    ) : Promise<O> {
        const dataSource = this.context.dataSource || await useDataSource();

        const entity = await this.make(params, true);
        const entityManager = dataSource.getRepository(this.context.entity);

        return entityManager.save(entity, options);
    }

    public async saveMany(
        amount: number,
        params?: Partial<O>,
        options?: SaveOptions,
    ) : Promise<O[]> {
        const promises : Promise<O>[] = [];

        for (let i = 0; i < amount; i++) {
            const item = this.save(params, options);

            promises.push(item);
        }

        return Promise.all(promises);
    }

    // --------------------------------------------------------------

    private async resolve(entity: O, save?: boolean) : Promise<O> {
        const keys = Object.keys(entity);

        for (const key of keys as (keyof O)[]) {
            const value : unknown = entity[key];

            if (!hasOwnProperty(entity, key)) {
                continue;
            }

            if (isSeederFactory(value)) {
                const factory = value;

                if (this.context.dataSource && !factory.context.dataSource) {
                    factory.context.dataSource = this.context.dataSource;
                }

                if (save) {
                    entity[key] = await factory.save();
                } else {
                    entity[key] = await factory.make();
                }
            } else if (isThenable(value)) {
                entity[key] = await value as O[keyof O];
            }
        }

        return entity;
    }
}
