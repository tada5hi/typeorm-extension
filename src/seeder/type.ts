import type { DataSource } from 'typeorm';
import type { TSConfig } from '../utils/tsconfig';
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
    /**
     * Root directory of the project.
     */
    root?: string,

    /**
     * Directory path to the tsconfig.json file
     *
     * Default: process.cwd() + path.sep + tsconfig.json
     */
    tsconfig?: string | TSConfig,

    /**
     * This option indicates if file paths should be preserved,
     * and treated as if the just-in-time compilation environment is detected.
     */
    preserveFilePaths?: boolean,
};

export type SeederPrepareElement = {
    constructor: SeederConstructor,
    timestamp?: number,
    fileName?: string,
    filePath?: string
};
