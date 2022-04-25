import { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from './module';
import { DataSourceOptionsBuildContext } from './type';

let instance : DataSourceOptions | undefined;

export function setDataSourceOptions(options: DataSourceOptions) {
    instance = options;
}

export async function useDataSourceOptions(context?: DataSourceOptionsBuildContext) {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    instance = await buildDataSourceOptions(context);

    return instance;
}
