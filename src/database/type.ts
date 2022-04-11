import { DataSourceOptions } from 'typeorm';

export type DatabaseBaseContext = {
    /**
     * Options for typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,
};

export type DatabaseCreateContext = DatabaseBaseContext & {
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

export type DatabaseDropContext = DatabaseBaseContext & {
    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};
