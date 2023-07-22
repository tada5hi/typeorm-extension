import type { TSConfig } from '../../utils/tsconfig';

export type DataSourceFindOptions = {
    /**
     * Directory where to look for DataSource files.
     */
    directory?: string,

    /**
     * DataSource file name.
     */
    fileName?: string,

    /**
     * This option indicates if file paths should be preserved,
     * and treated as if the just-in-time compilation environment is detected.
     */
    preserveFilePaths?: boolean,

    /**
     * Directory path to the tsconfig.json file
     *
     * Default: process.cwd() + path.sep + tsconfig.json
     */
    tsconfig?: string | TSConfig,
};
