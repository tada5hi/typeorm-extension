import { DataSource } from 'typeorm';
import { useRuntimeRegistry } from '../runtime';
import { useDataSourceOptions } from './options';

export function setDataSource(
    dataSource: DataSource,
    alias?: string,
) {
    useRuntimeRegistry().dataSources.set(alias || 'default', dataSource);
}

export function hasDataSource(alias?: string) : boolean {
    return useRuntimeRegistry().dataSources.has(alias || 'default');
}

export function unsetDataSource(alias?: string) {
    useRuntimeRegistry().dataSources.unset(alias || 'default');
}

export async function useDataSource(alias?: string) : Promise<DataSource> {
    const key = alias || 'default';

    return useRuntimeRegistry().dataSources.resolve(key, async (existing) => {
        if (existing) {
            if (!existing.isInitialized) {
                await existing.initialize();
            }

            return existing;
        }

        const options = await useDataSourceOptions(key);

        const dataSource = new DataSource(options);
        await dataSource.initialize();

        return dataSource;
    });
}
