import { DataSource, DataSourceOptions } from 'typeorm';

export async function synchronizeDatabase(options: DataSourceOptions) {
    const dataSource = new DataSource(options);
    await dataSource.initialize();
    await dataSource.synchronize(false);
    await dataSource.destroy();
}
