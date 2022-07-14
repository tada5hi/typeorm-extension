import { DataSource, DataSourceOptions, InstanceChecker } from 'typeorm';

export async function setupDatabaseSchema(input: DataSource | DataSourceOptions) {
    let dataSource : DataSource;

    if (InstanceChecker.isDataSource(input)) {
        dataSource = input;
    } else {
        dataSource = new DataSource(input);
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

    if (migrationsCount > 0) {
        await dataSource.runMigrations();
    } else {
        await dataSource.synchronize(false);
    }

    if (!InstanceChecker.isDataSource(input)) {
        await dataSource.destroy();
    }
}
