import { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from './module';

const instances : Record<string, DataSourceOptions> = {};
const instancePromises : Record<string, Promise<DataSourceOptions>> = {};

export function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string,
) {
    alias = alias || 'default';
    instances[alias] = options;
}

export function isSetDataSourceOptions(alias?: string) : boolean {
    alias = alias || 'default';

    return Object.prototype.hasOwnProperty.call(instances, alias);
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
                delete instancePromises[alias];

                throw e;
            });
    }

    instances[alias] = await instancePromises[alias];

    return instances[alias];
}
