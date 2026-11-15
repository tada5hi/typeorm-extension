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
     * Ignored for a passed or registered data source,
     * which is never destroyed.
     *
     * default: true
     */
    dataSourceCleanup?: boolean,

    /**
     * Use predefined data-source for checks.
     * It takes precedence over options and alias, and is never destroyed.
     * An uninitialized one is initialized and left initialized,
     * unless it has synchronize or migrationsRun set: then the check
     * runs on a copy without them and the passed one stays untouched.
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
