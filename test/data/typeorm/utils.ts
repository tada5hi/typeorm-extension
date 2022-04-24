import {createDatabase, dropDatabase, findDataSource, setDataSource, useDataSource} from "../../../src";
import path from "path";

export async function setupTestDatabase() {
    const dataSource = await findDataSource({
        directory: path.join(__dirname)
    });

    await createDatabase({
        options: dataSource.options
    });

    await dataSource.initialize();

    setDataSource(dataSource);
}

export async function destroyTestDatabase() {
    const dataSource = await useDataSource();
    await dataSource.destroy();

    await dropDatabase({
        options: dataSource.options
    });
}
