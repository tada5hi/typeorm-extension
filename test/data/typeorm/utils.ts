import { DataSource } from 'typeorm';
import {
    createDatabase,
    dropDatabase,
    setDataSource,
    unsetDataSource,
} from '../../../src';
import { createDataSourceOptions } from './factory';

export async function setupFsDataSource(name: string) : Promise<DataSource> {
    const options = createDataSourceOptions();
    Object.assign(options, {
        database: `writable/${name}.sqlite`,
    });

    await createDatabase({
        options,
    });

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    setDataSource(dataSource);

    return dataSource;
}

export async function destroyTestFsDataSource(dataSource: DataSource) {
    await dataSource.destroy();

    const { options } = dataSource;

    unsetDataSource();

    await dropDatabase({ options });
}
