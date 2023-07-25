import type { DataSourceOptions, Migration } from 'typeorm';
import { DataSource, InstanceChecker } from 'typeorm';

export async function synchronizeDatabaseSchema(
    input: DataSource | DataSourceOptions,
) : Promise<Migration[]> {
    let dataSource: DataSource;
    let options: DataSourceOptions;

    if (InstanceChecker.isDataSource(input)) {
        dataSource = input;
        options = dataSource.options;
    } else {
        options = input;
        dataSource = new DataSource(options);
    }

    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }

    let migrationsCount = 0;
    if (input.migrations) {
        migrationsCount = Array.isArray(input.migrations) ?
            input.migrations.length :
            Object.keys(input.migrations).length;
    }

    let migrations : Migration[] = [];

    if (migrationsCount > 0) {
        migrations = await dataSource.runMigrations({
            transaction: options.migrationsTransactionMode,
        });
    } else {
        await dataSource.synchronize(false);
    }

    if (!InstanceChecker.isDataSource(input)) {
        await dataSource.destroy();
    }

    return migrations;
}
