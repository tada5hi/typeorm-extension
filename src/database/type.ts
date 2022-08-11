import { DataSourceOptions } from 'typeorm';
import { DataSourceFindOptions } from '../data-source';

export type DatabaseBaseContext = {
    /**
     * Options for finding the typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,

    /**
     * Options for the find method, where to look for the data-source file.
     */
    findOptions?: DataSourceFindOptions,

    /**
     * Initial database to connect.
     *
     * default: undefined
     */
    initialDatabase?: string,
};

export type DatabaseCreateContext = DatabaseBaseContext & {
    /**
     * Only create database if not already exist.
     *
     * default: true
     */
    ifNotExist?: boolean,
    /**
     * Synchronize or migrate the database scheme.
     *
     * default: true
     */
    synchronize?: boolean
};

export type DatabaseDropContext = DatabaseBaseContext & {
    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};
