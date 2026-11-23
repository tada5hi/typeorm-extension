import type { DataSource } from 'typeorm';

export type MigrationGenerateResult = {
    up: string[],
    down: string[],
    content?: string
};

export type MigrationGenerateCommandContext = {
    /**
     * Directory where the migration(s) should be stored.
     */
    directoryPath?: string,
    /**
     * Name of the migration class.
     */
    name?: string,
    /**
     * DataSource used for reference of existing schema.
     */
    dataSource: DataSource,

    /**
     * Timestamp in milliseconds.
     */
    timestamp?: number,

    /**
     * Prettify sql statements.
     */
    prettify?: boolean,

    /**
     * Language of the generated migration file. It also determines the file extension.
     *
     * @default 'ts'
     */
    language?: 'ts' | 'js',

    /**
     * Generate an ESM (export class) instead of a CommonJS (module.exports) migration.
     * Only applies to the language js.
     *
     * @default false
     */
    esm?: boolean,

    /**
     * Only return up- & down-statements instead of backing up the migration to the file system.
     */
    preview?: boolean,

    /**
     * Qualify objects in the default schema (postgres: the current schema, e.g. public)
     * with its name. false leaves them unqualified, so up and down both resolve
     * through the search path, and the migration also runs in another schema.
     * Applies to drivers with a default schema (postgres, cockroachdb, mssql).
     *
     * @default true
     */
    schemaQualified?: boolean,
};
