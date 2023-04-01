import {
    buildDataSourceOptions,
    hasDataSource,
    hasDataSourceOptions,
    setDataSourceOptions,
    unsetDataSource,
    useDataSource
} from "../../../../src";
import {dataSource} from "../../../data/typeorm/data-source";

describe('src/data-source/options', function () {
    it('should set and use data-source options', async () => {
        setDataSourceOptions(dataSource.options);

        expect(hasDataSourceOptions()).toBeTruthy();
        expect(hasDataSource()).toBeFalsy();

        const instance = await useDataSource();
        expect(instance.options).toEqual(dataSource.options);

        unsetDataSource();
    });

    it('should build data-source options', async () => {
        const options = await buildDataSourceOptions({
            directory: 'test/data/typeorm'
        });

        expect(options).toBeDefined();
        expect(options.type).toEqual('better-sqlite3');
        expect(options.database).toBeDefined();
        expect(options.extra).toBeDefined();
    })
});
