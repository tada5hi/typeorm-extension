import {dataSource} from "../../data/typeorm/data-source";
import {
    isSetDataSource,
    isSetDataSourceOptions,
    setDataSource,
    setDataSourceOptions,
    unsetDataSource,
    useDataSource
} from "../../../src";

describe('src/data-source/singleton.ts', () => {
    it('should set and use datasource', async () => {
        setDataSource(dataSource);

        expect(isSetDataSource()).toBeTruthy();

        let instance = await useDataSource();
        expect(instance).toEqual(dataSource);

        instance = await useDataSource();
        expect(instance).toEqual(dataSource);

        unsetDataSource();
        expect(isSetDataSource()).toBeFalsy();
    });

    it('should set and use data-source with alias', async () => {
        expect(isSetDataSource('foo')).toBeFalsy();

        setDataSource(dataSource, 'foo');

        expect(isSetDataSource()).toBeFalsy();
        expect(isSetDataSource('foo')).toBeTruthy();

        const instance = await useDataSource('foo');
        expect(instance).toEqual(dataSource);

        unsetDataSource('foo');
        expect(isSetDataSource('foo')).toBeFalsy();
    })

    it('should set and use data-source options', async () => {
        setDataSourceOptions(dataSource.options);

        expect(isSetDataSourceOptions()).toBeTruthy();
        expect(isSetDataSource()).toBeFalsy();

        const instance = await useDataSource();
        expect(instance.options).toEqual(dataSource.options);

        unsetDataSource();
    })
})
