import type { DataSource, DataSourceOptions, Migration } from 'typeorm';

export type DatabaseCheckContext = {
    /**
     * Options for finding the typeorm DataSource.
     *
     * Default: undefined
     */
    options?: DataSourceOptions,

    /**
     * Use alias to access already registered DataSource / DataSourceOptions.
     *
     * default: undefined
     */
    alias?: string,

    /**
     * Indicates whether to destroy the data-source
     * afterward or not.
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
     * Indicates whether the database's schema
     * is up-to-date.
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
