import { DataSource, DataSourceOptions } from 'typeorm';

export async function synchronizeDatabase(options: DataSourceOptions) {
    const dataSource = new DataSource(options);
    await dataSource.initialize();

    let migrationsAmount = 0;
    if (options.migrations) {
        migrationsAmount = Array.isArray(options.migrations) ?
            options.migrations.length :
            Object.keys(options.migrations).length;
    }

    if (migrationsAmount > 0) {
        await dataSource.runMigrations();
    } else {
        await dataSource.synchronize(false);
    }

    await dataSource.destroy();
}
