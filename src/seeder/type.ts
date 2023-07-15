import type { DataSource } from 'typeorm';
import type { SeederFactoryConfig, SeederFactoryManager } from './factory';

export interface Seeder {
    /**
     * Default: false
     */
    oneTimeOnly?: boolean;

    run(dataSource: DataSource, factoryManager: SeederFactoryManager) : Promise<any>;
}

export type SeederConstructor = new () => Seeder;

export type SeederOptions = {
    seeds?: SeederConstructor[] | string[],
    seedName?: string,
    seedTableName?: string,

    factories?: SeederFactoryConfig[] | string[],
    factoriesLoad?: boolean,

    parallelExecution?: boolean
};

export type SeederPrepareElement = {
    constructor: SeederConstructor,
    timestamp?: number,
    fileName?: string
};
