import { DataSource } from 'typeorm';
import { AsyncKeyedCache } from '../runtime';
import { useDataSourceOptions } from './options';

const instances = new AsyncKeyedCache<DataSource>();

export function setDataSource(
    dataSource: DataSource,
    alias?: string,
) {
    instances.set(alias || 'default', dataSource);
}

export function hasDataSource(alias?: string) : boolean {
    return instances.has(alias || 'default');
}

export function unsetDataSource(alias?: string) {
    instances.unset(alias || 'default');
}

export async function useDataSource(alias?: string) : Promise<DataSource> {
    const key = alias || 'default';

    return instances.resolve(key, async (existing) => {
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
