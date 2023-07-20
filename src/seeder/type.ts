import type { DataSource } from 'typeorm';
import type { SeederFactoryItem, SeederFactoryManager } from './factory';

export interface Seeder {
    /**
     * Track seeder execution.
     *
     * Default: false
     */
    track?: boolean;

    run(dataSource: DataSource, factoryManager: SeederFactoryManager) : Promise<any>;
}

export type SeederConstructor = new () => Seeder;

export type SeederOptions = {
    seeds?: SeederConstructor[] | string[],
    seedName?: string,
    seedTableName?: string,
    seedTracking?: boolean

    factories?: SeederFactoryItem[] | string[],
    factoriesLoad?: boolean
};

export type SeederExecutorOptions = {
    root?: string,
    tsconfig?: string
};

export type SeederPrepareElement = {
    constructor: SeederConstructor,
    timestamp?: number,
    fileName?: string
};
