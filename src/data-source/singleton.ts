import { DataSource } from 'typeorm';
import { DataSourceOptionsBuildContext, useDataSourceOptions } from './options';

let instance : DataSource | undefined;

export function setDataSource(dataSource: DataSource) {
    instance = dataSource;
}

export function unsetDataSource() {
    instance = undefined;
}

export async function useDataSource(context?: DataSourceOptionsBuildContext) {
    if (typeof instance !== 'undefined') {
        if (!instance.isInitialized) {
            await instance.initialize();
        }

        return instance;
    }

    const options = await useDataSourceOptions(context);

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    instance = dataSource;

    return dataSource;
}
