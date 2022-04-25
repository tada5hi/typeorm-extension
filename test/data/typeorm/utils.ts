import {
    buildDataSourceOptions,
    createDatabase,
    dropDatabase,
    setDataSource,
    unsetDataSource,
    useDataSource
} from "../../../src";
import {DataSource} from "typeorm";

export async function setupTestDatabase() {
    const options = await buildDataSourceOptions({
        directory: __dirname
    })

    await createDatabase({
        options
    });

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    setDataSource(dataSource);
}

export async function destroyTestDatabase() {
    const dataSource = await useDataSource();
    await dataSource.destroy();

    await dropDatabase({
        options: dataSource.options
    });

    unsetDataSource()
}
