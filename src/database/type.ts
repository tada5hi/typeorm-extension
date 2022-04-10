import { DataSourceOptions } from 'typeorm';

export type DatabaseCreateContext = {
    /**
     * Options for typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,
    /**
     * Only create database if not already exist.
     *
     * default: true
     */
    ifNotExist?: boolean,
    /**
     * Initial database to connect.
     *
     * default: undefined
     */
    initialDatabase?: string,
    /**
     * Synchronize database entities.
     *
     * default: true
     */
    synchronize?: boolean
};

export type DatabaseDropContext = {
    /**
     * Options for typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,
    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};
