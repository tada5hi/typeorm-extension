import type { DataSourceOptions } from 'typeorm';
import { buildConnectionParams } from '../../../../src/database/core';

describe('src/database/core/params', () => {
    it('should build params for postgres options', () => {
        const params = buildConnectionParams({
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'admin',
            password: 'secret',
            database: 'app',
            schema: 'tenant',
        } as DataSourceOptions);

        expect(params.host).toEqual('localhost');
        expect(params.port).toEqual(5432);
        expect(params.user).toEqual('admin');
        expect(params.password).toEqual('secret');
        expect(params.database).toEqual('app');
        expect(params.schema).toEqual('tenant');
    });

    it('should read charset & characterSet from options', () => {
        const params = buildConnectionParams({
            type: 'mysql',
            database: 'app',
            charset: 'utf8mb4_general_ci',
        } as DataSourceOptions);

        expect(params.charset).toEqual('utf8mb4_general_ci');
        expect(params.characterSet).toBeUndefined();
    });

    it('should fall back to the extra record for charset options', () => {
        const params = buildConnectionParams({
            type: 'postgres',
            database: 'app',
            extra: {
                characterSet: 'UTF8',
            },
        } as DataSourceOptions);

        expect(params.characterSet).toEqual('UTF8');
        expect(params.extra).toEqual({ characterSet: 'UTF8' });
    });
});
