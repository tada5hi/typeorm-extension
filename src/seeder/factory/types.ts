import type {
    DataSource,
    EntitySchema,
    ObjectType,
    SaveOptions,
} from 'typeorm';

/**
 * The meta argument is undefined, as long as SeederFactory.setMeta() was not called.
 */
export type FactoryCallback<O, Meta = unknown> = (meta: Meta | undefined) => O | Promise<O>;

export type SeederFactoryItem = {
    factoryFn: FactoryCallback<any, any>,
    entity: ObjectType<any> | EntitySchema<any>
};

export type SeederFactoryContext<O, Meta = unknown> = {
    name: string,
    entity: ObjectType<O> | EntitySchema<O>,
    factoryFn: FactoryCallback<O, Meta>,
    dataSource?: DataSource
};

export type SeederFactoryManagerContext = {
    items?: Record<string, SeederFactoryItem>,
    dataSource?: DataSource
};

export interface ISeederFactory<O extends Record<string, any>, Meta = unknown> {
    readonly context: SeederFactoryContext<O, Meta>;

    setMeta(value: Meta) : this;

    make(params?: Partial<O>, save?: boolean) : Promise<O>;

    save(params?: Partial<O>, options?: SaveOptions) : Promise<O>;

    saveMany(amount: number, params?: Partial<O>, options?: SaveOptions) : Promise<O[]>;
}
