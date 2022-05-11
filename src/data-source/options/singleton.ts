import { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions } from './module';

let instances : Record<string, DataSourceOptions>;
let instancePromises : Record<string, Promise<DataSourceOptions>>;

export function setDataSourceOptions(
    options: DataSourceOptions,
    alias?: string,
) {
    alias = alias || 'default';
    instances[alias] = options;
}

export async function useDataSourceOptions(alias?: string) {
    alias = alias || 'default';

    if (Object.prototype.hasOwnProperty.call(instances, alias)) {
        return instances[alias];
    }

    if (!Object.prototype.hasOwnProperty.call(instances, alias)) {
        instancePromises[alias] = buildDataSourceOptions();
    }

    instances[alias] = await instancePromises[alias];

    return instances[alias];
}
