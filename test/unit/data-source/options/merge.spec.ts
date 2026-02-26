import {
    describe, expect, it,
} from 'vitest';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
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
        expect((options as PostgresConnectionOptions).password).toEqual('password');
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
        expect((options as PostgresConnectionOptions).password).toBeUndefined();
    });
});
