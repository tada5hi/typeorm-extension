import type { DataSourceOptions } from 'typeorm';
import { AsyncKeyedCache } from '../../runtime';
import { buildDataSourceOptions } from './module';

const instances = new AsyncKeyedCache<DataSourceOptions>();

export function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string,
) {
    instances.set(alias || 'default', options);
}

export function hasDataSourceOptions(alias?: string) : boolean {
    return instances.has(alias || 'default');
}

export async function useDataSourceOptions(alias?: string) : Promise<DataSourceOptions> {
    return instances.resolve(
        alias || 'default',
        async (existing) => existing || buildDataSourceOptions(),
    );
}
