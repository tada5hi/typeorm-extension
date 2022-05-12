import { DataSource, DataSourceOptions } from 'typeorm';
import { useDataSourceOptions } from './options';

const instances : Record<string, DataSource> = {};

const initializePromises : Record<string, Promise<DataSource>> = {};
const optionsPromises: Record<string, Promise<DataSourceOptions>> = {};

export function setDataSource(
    dataSource: DataSource,
    alias?: string,
) {
    alias = alias || 'default';

    instances[alias] = dataSource;
}

export function unsetDataSource(alias?: string) {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        delete instances[alias];
    }

    if (Object.prototype.hasOwnProperty.call(optionsPromises, alias)) {
        delete optionsPromises[alias];
    }

    if (Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
        delete initializePromises[alias];
    }
}

export async function useDataSource(alias?: string) : Promise<DataSource> {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        if (!instances[alias].isInitialized) {
            if (!Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
                initializePromises[alias] = instances[alias].initialize();
            }

            await initializePromises[alias];
        }

        return instances[alias];
    }

    if (!Object.prototype.hasOwnProperty.call(optionsPromises, alias)) {
        optionsPromises[alias] = useDataSourceOptions(alias);
    }

    const options = await optionsPromises[alias];

    const dataSource = new DataSource(options);
    if (!Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
        initializePromises[alias] = dataSource.initialize();
    }

    await initializePromises[alias];

    instances[alias] = dataSource;

    return dataSource;
}
