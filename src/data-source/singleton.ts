import { DataSource } from 'typeorm';
import { useDataSourceOptions } from './options';

let instance : DataSource | undefined;

export function setDataSource(dataSource: DataSource) {
    instance = dataSource;
}

export async function useDataSource() {
    if (typeof instance !== 'undefined') {
        if (!instance.isInitialized) {
            await instance.initialize();
        }

        return instance;
    }

    const options = await useDataSourceOptions();

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    instance = dataSource;

    return dataSource;
}
