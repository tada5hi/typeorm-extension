import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
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

export function hasDataSource(alias?: string) : boolean {
    alias = alias || 'default';

    return Object.prototype.hasOwnProperty.call(instances, alias);
}

export function unsetDataSource(alias?: string) {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        delete instances[alias];
    }

    /* istanbul ignore next */
    if (Object.prototype.hasOwnProperty.call(optionsPromises, alias)) {
        delete optionsPromises[alias];
    }

    /* istanbul ignore next */
    if (Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
        delete initializePromises[alias];
    }
}

export async function useDataSource(alias?: string) : Promise<DataSource> {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        if (!instances[alias].isInitialized) {
            /* istanbul ignore next */
            if (!Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
                initializePromises[alias] = instances[alias].initialize()
                    .catch((e) => {
                        if (alias) {
                            delete initializePromises[alias];
                        }

                        throw e;
                    });
            }

            await initializePromises[alias];
        }

        return instances[alias];
    }

    /* istanbul ignore next */
    if (!Object.prototype.hasOwnProperty.call(optionsPromises, alias)) {
        optionsPromises[alias] = useDataSourceOptions(alias)
            .catch((e) => {
                if (alias) {
                    delete optionsPromises[alias];
                }

                throw e;
            });
    }

    const options = await optionsPromises[alias];

    const dataSource = new DataSource(options);

    /* istanbul ignore next */
    if (!Object.prototype.hasOwnProperty.call(initializePromises, alias)) {
        initializePromises[alias] = dataSource.initialize()
            .catch((e) => {
                if (alias) {
                    delete initializePromises[alias];
                }

                throw e;
            });
    }

    await initializePromises[alias];

    instances[alias] = dataSource;

    return dataSource;
}
