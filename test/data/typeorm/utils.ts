import {
    buildDataSourceOptions, checkDatabase,
    createDatabase,
    dropDatabase, hasDataSource,
    setDataSource,
    unsetDataSource,
    useDataSource
} from "../../../src";
import {DataSource} from "typeorm";

export async function setupTestDatabase() : Promise<DataSource> {
    const options = await buildDataSourceOptions({
        directory: __dirname
    })

    await createDatabase({
        options
    });

    const dataSource = new DataSource(options);
    await dataSource.initialize();

    setDataSource(dataSource);

    return dataSource;
}

export async function checkTestDatabase() {
    const options = await buildDataSourceOptions({
        directory: __dirname
    });

    return await checkDatabase({
        options
    })
}

export async function destroyTestDatabase() {
    if(!hasDataSource()) {
        const options = await buildDataSourceOptions({
            directory: __dirname
        });
        await dropDatabase({options});

        return;
    }

    const dataSource = await useDataSource();
    await dataSource.destroy();

    const { options } = dataSource;

    unsetDataSource();

    await dropDatabase({options});
}
