import type { DataSource, DataSourceOptions, Migration } from 'typeorm';
import type { DataSourceFindOptions } from '../data-source';

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

export type DatabaseCheckContext = Omit<DatabaseBaseContext, 'initialDatabase'> & {
    /**
     * Use alias to access already registered DataSource / DataSourceOptions.
     *
     * default: undefined
     */
    alias?: string,

    /**
     * Indicates whether to destroy the data-source
     * afterwards or not.
     * If a datasource previously existed, this option will be ignored.
     *
     * default: true
     */
    dataSourceCleanup?: boolean,

    /**
     * Use predefined data-source for checks.
     *
     * default: undefined
     */
    dataSource?: DataSource
};

export type DatabaseCheckResult = {
    /**
     * Indicates whether the database
     * has already been created or not.
     *
     * default: false
     */
    exists: boolean,

    /**
     * Indicates whether the database's schema was lazy
     * synchronized or created using migrations.
     *
     * default: false
     */
    schema: boolean,

    /**
     * Array of un applied migrations.
     *
     * default: []
     */
    migrationsPending: Migration[]
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
