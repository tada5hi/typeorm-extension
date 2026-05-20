import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { mergeDataSourceOptions } from '../../../../src';

describe('src/data-source/options/merge', () => {
    it('should merge data source options', () => {
        const options = mergeDataSourceOptions({
            type: 'postgres',
            password: undefined,
        }, {
            type: 'postgres',
            password: 'password',
        });

        expect(options).toBeDefined();
        expect(options.type).toEqual('postgres');
        expect((options as PostgresDataSourceOptions).password).toEqual('password');
    });

    it('should not merge data source options', () => {
        const options = mergeDataSourceOptions({
            type: 'postgres',
            password: undefined,
        }, {
            type: 'mysql',
            password: 'password',
        });

        expect(options).toBeDefined();
        expect(options.type).toEqual('postgres');
        expect((options as PostgresDataSourceOptions).password).toBeUndefined();
    });
});
