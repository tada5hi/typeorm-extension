import { hasOwnProperty, isPromise  } from '../../utils';
import type { SaveOptions } from 'typeorm';
import { useDataSource } from '../../data-source';
import type { SeederFactoryContext } from './type';

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
        const factoryFn = this.context.factoryFn(this.meta);
        let entity : O;
        if (isPromise(factoryFn)) {
            entity = await this.resolve(await factoryFn, save);
        } else {
            entity = await this.resolve(factoryFn, save);
        }

        if (params) {
            const keys : (keyof O)[] = Object.keys(params);
            for (const key of keys) {
                entity[key] = (params as O)[key];
            }
        }

        return entity;
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
            const value : O[keyof O] = entity[key];

            if (!hasOwnProperty(entity, key)) {
                continue;
            }

            if (
                typeof value === 'object' &&
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                value instanceof SeederFactory
            ) {
                const factory = value as SeederFactory<any>;
                if (this.context.dataSource && !factory.context.dataSource) {
                    factory.context.dataSource = this.context.dataSource;
                }

                if (save) {
                    entity[key] = await factory.save();
                } else {
                    entity[key] = await factory.make();
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
