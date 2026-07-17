import type { DataSourceOptions } from 'typeorm';
import { useRuntimeRegistry } from '../../runtime';
import { buildDataSourceOptions } from './module';

export function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string,
) {
    useRuntimeRegistry().dataSourceOptions.set(alias || 'default', options);
}

export function hasDataSourceOptions(alias?: string) : boolean {
    return useRuntimeRegistry().dataSourceOptions.has(alias || 'default');
}

export async function useDataSourceOptions(alias?: string) : Promise<DataSourceOptions> {
    return useRuntimeRegistry().dataSourceOptions.resolve(
        alias || 'default',
        async (existing) => existing || buildDataSourceOptions(),
    );
}
