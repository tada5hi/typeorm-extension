import type { DataSource, DataSourceOptions } from 'typeorm';
import type { Environment } from '../env/type';
import type { SeederFactoryManager } from '../seeder/factory/manager';
import { AsyncKeyedCache } from './cache';

export class RuntimeRegistry {
    public readonly dataSources = new AsyncKeyedCache<DataSource>();

    public readonly dataSourceOptions = new AsyncKeyedCache<DataSourceOptions>();

    public env : Environment | undefined;

    public factories : SeederFactoryManager | undefined;

    reset() : void {
        this.dataSources.clear();
        this.dataSourceOptions.clear();
        this.env = undefined;
        this.factories = undefined;
    }
}

let instance : RuntimeRegistry | undefined;

export function useRuntimeRegistry() : RuntimeRegistry {
    if (typeof instance === 'undefined') {
        instance = new RuntimeRegistry();
    }

    return instance;
}
