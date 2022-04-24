import { DataSourceOptions } from 'typeorm';
import { DataSourceFindOptions, findDataSource } from '../find';
import { buildDataSourceOptions, extendDataSourceOptions } from './module';

let instance : DataSourceOptions | undefined;

export function setDataSourceOptions(options: DataSourceOptions) {
    instance = options;
}

export async function useDataSourceOptions(options?: DataSourceFindOptions) {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    const dataSource = await findDataSource(options);
    if (dataSource) {
        instance = await extendDataSourceOptions(
            dataSource.options,
            options.directory || process.cwd(),
        );

        return instance;
    }

    instance = await buildDataSourceOptions({
        buildForCommand: true,
    });

    return instance;
}
