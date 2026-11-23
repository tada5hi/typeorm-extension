import type { DataSource, DataSourceOptions, Migration } from 'typeorm';
import type { MigrationRunOptions } from './migration';
import { runDatabaseMigrations } from './migration';
import { useInitializedDataSource } from './utils';

export async function synchronizeDatabaseSchema(
    input: DataSource | DataSourceOptions,
    options: Pick<MigrationRunOptions, 'transaction' | 'lock' | 'ignoreTables'> = {},
) : Promise<Migration[]> {
    // typeorm's own runner in initialize() knows no baselines and takes no lock.
    const { dataSource, owned } = await useInitializedDataSource(input, { migrationsRun: false });

    try {
        const { options: dataSourceOptions } = dataSource;

        let migrationsCount = 0;

        if (dataSourceOptions.migrations) {
            migrationsCount = Array.isArray(dataSourceOptions.migrations) ?
                dataSourceOptions.migrations.length :
                Object.keys(dataSourceOptions.migrations).length;
        }

        if (migrationsCount > 0) {
            return await runDatabaseMigrations(dataSource, {
                transaction: options.transaction,
                lock: options.lock,
                ignoreTables: options.ignoreTables,
            });
        }

        await dataSource.synchronize(false);

        return [];
    } finally {
        if (owned) {
            await dataSource.destroy();
        }
    }
}
