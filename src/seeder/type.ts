import { DataSource } from 'typeorm';
import { SeederFactoryConfig, SeederFactoryManager } from './factory';

export interface Seeder {
    run(dataSource: DataSource, factoryManager: SeederFactoryManager) : Promise<any>;
}

export type SeederConstructor = new () => Seeder;

export type SeederOptions = {
    seeds?: SeederConstructor[] | string[],
    seedName?: string,

    factories?: SeederFactoryConfig[] | string[],
    factoriesLoad?: boolean,

    parallelExecution?: boolean
};
