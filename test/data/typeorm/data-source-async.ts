import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './factory';

export default async function createDataSource() : Promise<DataSource> {
    return new DataSource({
        ...createDataSourceOptions(),
        extra: { marker: 'async' },
    });
}
