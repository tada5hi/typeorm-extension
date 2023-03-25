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
     * Only return up- & down-statements instead of backing up the migration to the file system.
     */
    preview?: boolean
};
