import type { DataSourceOptions, Migration } from 'typeorm';
import type { IPathResolver } from '../../../utils';

export type MigrationsInput = DataSourceOptions['migrations'];

export type MigrationBaselineClass = {
    baseline: true,
    legacy?: MigrationsInput,
    upgradeHint?: string,
    name: string
};

export type MigrationSource = {
    current: Migration[],
    baseline?: Migration,
    legacy?: Migration[],
    upgradeHint?: string
};

export type MigrationSourceScanOptions = {
    /**
     * Resolves the legacy globs like the `migrations` key of the data source options
     * (src -> outDir, .ts -> .js).
     *
     * Default: createPathResolver({ mode: 'auto' })
     */
    pathResolver?: IPathResolver,

    baseline?: MigrationBaselineClass
};
