import { useEnv } from '../../../src/env';
import { useRuntimeRegistry } from '../../../src/runtime';
import {
    hasDataSource,
    hasDataSourceOptions,
    setDataSource,
    setDataSourceOptions,
    useSeederFactoryManager,
} from '../../../src';
import { dataSource } from '../../data/typeorm/data-source';

describe('src/runtime/module.ts', () => {
    afterEach(() => {
        useRuntimeRegistry().reset();
    });

    it('should return the same registry instance', () => {
        expect(useRuntimeRegistry()).toBe(useRuntimeRegistry());
    });

    it('should hold state of the singleton accessors', () => {
        const registry = useRuntimeRegistry();

        setDataSource(dataSource, 'foo');
        expect(registry.dataSources.has('foo')).toBeTruthy();

        setDataSourceOptions(dataSource.options, 'foo');
        expect(registry.dataSourceOptions.has('foo')).toBeTruthy();

        useEnv();
        expect(registry.env).toBeDefined();

        const manager = useSeederFactoryManager();
        expect(registry.factories).toBe(manager);
    });

    it('should restore a pristine state on reset', () => {
        const registry = useRuntimeRegistry();

        setDataSource(dataSource);
        setDataSourceOptions(dataSource.options);
        useEnv();
        const manager = useSeederFactoryManager();

        registry.reset();

        expect(hasDataSource()).toBeFalsy();
        expect(hasDataSourceOptions()).toBeFalsy();
        expect(registry.env).toBeUndefined();
        expect(registry.factories).toBeUndefined();

        expect(useSeederFactoryManager()).not.toBe(manager);
    });
});
