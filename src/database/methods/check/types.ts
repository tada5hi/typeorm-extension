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
     * Without options, a DataSource registered under the alias is
     * handled like a passed dataSource. Otherwise the options
     * registered or discovered for the alias are used.
     *
     * default: undefined
     */
    alias?: string,

    /**
     * Indicates whether to destroy the data-source
     * built from options afterward or not.
     * Ignored for a passed or registered data source:
     * an initialized one is never destroyed,
     * a copy of an uninitialized one always is.
     *
     * default: true
     */
    dataSourceCleanup?: boolean,

    /**
     * Use predefined data-source for checks.
     * It takes precedence over options and alias.
     * An initialized one is used as is and never destroyed.
     * An uninitialized one is left untouched and the check runs on a copy.
     * A copy never synchronizes, runs migrations or drops the schema.
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
