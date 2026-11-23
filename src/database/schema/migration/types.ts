import type { DataSourceOptions } from 'typeorm';

export type MigrationsInput = DataSourceOptions['migrations'];

export type MigrationBaselineClass = {
    baseline: true,
    legacy?: MigrationsInput,
    upgradeHint?: string,
    name: string
};
