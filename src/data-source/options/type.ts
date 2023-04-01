export type DataSourceOptionsBuildContext = {
    /**
     * Database connection name
     * Default: default
     *
     * @deprecated
     */
    name?: string,
    /**
     * Configuration file name without extension
     * Default: ormconfig
     *
     * @deprecated
     */
    configName?: string,
    /**
     * Data source file name without extension
     * Default: data-source
     */
    dataSourceName?: string,
    /**
     * Directory where to find dataSource + config
     * Default: process.cwd()
     */
    directory?: string,
    /**
     * Directory path to the tsconfig.json file
     * Default: process.cwd()
     */
    tsconfigDirectory?: string,

    /**
     * Use experimental features,
     * like merging env and file data-source options.
     */
    experimental?: boolean
};
