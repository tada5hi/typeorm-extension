import type { DataSource, DataSourceOptions, Migration } from 'typeorm';
import type { MigrationRunOptions } from './migration';
import { runDatabaseMigrations } from './migration';
import { useInitializedDataSource } from './utils';

export async function synchronizeDatabaseSchema(
    input: DataSource | DataSourceOptions,
    options: Pick<MigrationRunOptions, 'transaction' | 'lock'> = {},
) : Promise<Migration[]> {
    const { dataSource, owned } = await useInitializedDataSource(input);
    const { options: dataSourceOptions } = dataSource;

    let migrationsCount = 0;

    if (dataSourceOptions.migrations) {
        migrationsCount = Array.isArray(dataSourceOptions.migrations) ?
            dataSourceOptions.migrations.length :
            Object.keys(dataSourceOptions.migrations).length;
    }

    let migrations : Migration[] = [];

    if (migrationsCount > 0) {
        migrations = await runDatabaseMigrations(dataSource, {
            transaction: options.transaction,
            lock: options.lock,
        });
    } else {
        await dataSource.synchronize(false);
    }

    if (owned) {
        await dataSource.destroy();
    }

    return migrations;
}
