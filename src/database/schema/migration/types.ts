import type { DataSourceOptions, Migration } from 'typeorm';

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
    baseline?: MigrationBaselineClass
};
