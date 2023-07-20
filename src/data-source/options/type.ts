export type DataSourceOptionsBuildContext = {
    /**
     * Data source file name without extension
     *
     * Default: data-source
     */
    dataSourceName?: string,
    /**
     * Directory where to find dataSource + config
     *
     * Default: process.cwd()
     */
    directory?: string,
    /**
     * Directory path to the tsconfig.json file
     *
     * Default: process.cwd() + path.sep + tsconfig.json
     */
    tsconfig?: string
};
