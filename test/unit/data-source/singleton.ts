import {dataSource} from "../../data/typeorm/data-source";
import {
    hasDataSource,
    setDataSource,
    unsetDataSource,
    useDataSource
} from "../../../src";

describe('src/data-source/singleton.ts', () => {
    it('should set and use datasource', async () => {
        setDataSource(dataSource);

        expect(hasDataSource()).toBeTruthy();

        let instance = await useDataSource();
        expect(instance).toEqual(dataSource);

        instance = await useDataSource();
        expect(instance).toEqual(dataSource);

        unsetDataSource();
        expect(hasDataSource()).toBeFalsy();
    });

    it('should set and use data-source with alias', async () => {
        expect(hasDataSource('foo')).toBeFalsy();

        setDataSource(dataSource, 'foo');

        expect(hasDataSource()).toBeFalsy();
        expect(hasDataSource('foo')).toBeTruthy();

        const instance = await useDataSource('foo');
        expect(instance).toEqual(dataSource);

        unsetDataSource('foo');
        expect(hasDataSource('foo')).toBeFalsy();
    })
})
