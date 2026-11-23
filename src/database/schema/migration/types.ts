import type { DataSourceOptions, Migration, QueryRunner } from 'typeorm';
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

export type MigrationPlanOptions = MigrationSourceScanOptions & {
    /**
     * Query runner to read the database state with. It is used as is and never released.
     *
     * Default: a query runner created from the data source and released after planning.
     */
    queryRunner?: QueryRunner,

    /**
     * Tables which do not count as user tables (e.g. owned by another data source sharing the database).
     */
    ignoreTables?: string[]
};

export type MigrationPlan = {
    source: MigrationSource,
    /**
     * Rows of the migrations table.
     */
    executed: Migration[],
    /**
     * Legacy migrations to run before the baseline is recorded.
     */
    legacy: Migration[],
    /**
     * Record the baseline as executed without running it.
     */
    adopt: boolean,
    /**
     * Migrations to run, in timestamp order.
     */
    pending: Migration[]
};
