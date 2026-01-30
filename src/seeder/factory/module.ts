import type { FakerOptions, LocaleDefinition } from '@faker-js/faker';
import type { Faker } from '@faker-js/faker';
import { isObject, load } from 'locter';
import type { SaveOptions } from 'typeorm';
import { useDataSource } from '../../data-source';
import { hasOwnProperty, isPromise } from '../../utils';
import type { SeederFactoryContext } from './type';

export class SeederFactory<O extends Record<string, any>, Meta = unknown> {
    public readonly context: SeederFactoryContext<O, Meta>;

    public meta: Meta | undefined;

    protected faker : Faker | undefined;

    protected locale : string[] | undefined;

    // --------------------------------------------------------------

    constructor(context: SeederFactoryContext<O, Meta>) {
        this.context = context;
    }

    // --------------------------------------------------------------

    public setMeta(value: Meta) {
        this.meta = value;

        return this;
    }

    public setLocale(value: string | string[]) {
        this.faker = undefined;

        this.locale = Array.isArray(value) ?
            value :
            [value];
    }

    // --------------------------------------------------------------

    public async make(params?: Partial<O>, save?: boolean) {
        const faker = await this.useFaker();
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

    protected async useFaker() : Promise<Faker> {
        if (typeof this.faker !== 'undefined') {
            return this.faker;
        }

        const options : FakerOptions = {
            locale: [],
        };

        const fakerExports = await load('@faker-js/faker');

        let names : string[];
        if (this.locale) {
            names = Array.isArray(this.locale) ?
                this.locale :
                [this.locale];
        } else {
            names = ['en'];
        }

        for (let i = 0; i < names.length; i++) {
            if (
                hasOwnProperty(fakerExports, 'default') &&
                isObject(fakerExports.default) &&
                hasOwnProperty(fakerExports.default, names[i])
            ) {
                (options.locale as LocaleDefinition[]).push(fakerExports.default[names[i]] as LocaleDefinition);
                continue;
            }

            if (hasOwnProperty(fakerExports, names[i])) {
                (options.locale as LocaleDefinition[]).push(fakerExports[names[i]] as LocaleDefinition);
            }
        }

        this.faker = new fakerExports.Faker(options);

        return this.faker!;
    }
}
