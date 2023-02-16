import type { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from './module';

const instances : Record<string, DataSourceOptions> = {};
const instancePromises : Record<string, Promise<DataSourceOptions>> = {};

export function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string,
) {
    instances[alias || 'default'] = options;
}

export function hasDataSourceOptions(alias?: string) : boolean {
    return Object.prototype.hasOwnProperty.call(instances, alias || 'default');
}

export async function useDataSourceOptions(alias?: string) : Promise<DataSourceOptions> {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        return instances[alias];
    }

    /* istanbul ignore next */
    if (!Object.prototype.hasOwnProperty.call(instancePromises, alias)) {
        instancePromises[alias] = buildDataSourceOptions()
            .catch((e) => {
                if (alias) {
                    delete instancePromises[alias];
                }

                throw e;
            });
    }

    instances[alias] = await instancePromises[alias];

    return instances[alias];
}
