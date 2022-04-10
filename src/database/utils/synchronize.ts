import { DataSource, DataSourceOptions } from 'typeorm';

export async function synchronizeDatabase(options: DataSourceOptions) {
    const connection = new DataSource(options);
    await connection.initialize();
    await connection.synchronize(false);
    await connection.destroy();
}
