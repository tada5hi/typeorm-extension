import type { DataSource, DataSourceOptions, Migration } from 'typeorm';
import { useInitializedDataSource } from './utils';

export async function synchronizeDatabaseSchema(
    input: DataSource | DataSourceOptions,
) : Promise<Migration[]> {
    const { dataSource, owned } = await useInitializedDataSource(input);
    const { options } = dataSource;

    let migrationsCount = 0;
    if (options.migrations) {
        migrationsCount = Array.isArray(options.migrations) ?
            options.migrations.length :
            Object.keys(options.migrations).length;
    }

    let migrations : Migration[] = [];

    if (migrationsCount > 0) {
        migrations = await dataSource.runMigrations({ transaction: options.migrationsTransactionMode });
    } else {
        await dataSource.synchronize(false);
    }

    if (owned) {
        await dataSource.destroy();
    }

    return migrations;
}
