import type { DataSourceOptions } from 'typeorm';
import type { DataSourceFindOptions } from '../../data-source';

export type DatabaseBaseContext = {
    /**
     * Options for finding the typeorm DataSource.
     */
    options: DataSourceOptions,

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

export type DatabaseBaseContextInput = Partial<DatabaseBaseContext>;

export type DatabaseCreateContext = Omit<DatabaseBaseContext, 'findOptions'> & {
    /**
     * Only create database if not already exist.
     *
     * default: true
     */
    ifNotExist: boolean,

    /**
     * Synchronize or migrate the database scheme.
     *
     * default: true
     */
    synchronize: boolean
};

export type DatabaseCreateContextInput = Partial<DatabaseCreateContext>;

export type DatabaseDropContext = Omit<DatabaseBaseContext, 'findOptions'> & {

    /**
     * Only drop database if existed.
     *
     * Default: true
     */
    ifExist?: boolean
};

export type DatabaseDropContextInput = Partial<DatabaseDropContext>;
