import { dataSource } from '../../data/typeorm/data-source';
import {
    hasDataSource,
    setDataSource,
    setDataSourceOptions,
    unsetDataSource,
    useDataSource,
} from '../../../src';
import { createDataSourceOptions } from '../../data/typeorm/factory';

describe('src/data-source/singleton.ts', () => {
    afterAll(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

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
    });

    it('should build one data-source for concurrent calls', async () => {
        setDataSourceOptions(createDataSourceOptions(), 'concurrent');

        const [first, second] = await Promise.all([
            useDataSource('concurrent'),
            useDataSource('concurrent'),
        ]);

        expect(first).toBe(second);
        expect(first.isInitialized).toBeTruthy();

        await first.destroy();
        unsetDataSource('concurrent');
    });
});
