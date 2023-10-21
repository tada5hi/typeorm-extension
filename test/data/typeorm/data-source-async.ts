import type { DataSource } from 'typeorm';
import { dataSource } from './data-source';

let instance : DataSource | undefined;
let instancePromise : Promise<DataSource> | undefined;

export async function useDataSource() {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    if (typeof instancePromise === 'undefined') {
        instancePromise = dataSource.initialize();
    }

    instance = await instancePromise;

    return instance;
}
