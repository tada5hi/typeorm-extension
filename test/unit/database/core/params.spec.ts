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

    it('should build params for oracle options', () => {
        const params = buildConnectionParams({
            type: 'oracle',
            host: 'localhost',
            port: 1521,
            username: 'system',
            password: 'secret',
            database: 'app',
            sid: 'xe',
            serviceName: 'orcl',
        } as DataSourceOptions);

        expect(params.sid).toEqual('xe');
        expect(params.serviceName).toEqual('orcl');
    });

    it('should build params for mssql options', () => {
        const params = buildConnectionParams({
            type: 'mssql',
            host: 'localhost',
            username: 'sa',
            password: 'secret',
            database: 'app',
            domain: 'corp',
            extra: { trustServerCertificate: true },
        } as DataSourceOptions);

        expect(params.domain).toEqual('corp');
        expect(params.extra).toEqual({ trustServerCertificate: true });
    });

    it('should carry the driver specific options of mssql', () => {
        const params = buildConnectionParams({
            type: 'mssql',
            host: 'localhost',
            username: 'sa',
            password: 'secret',
            database: 'app',
            options: {
                encrypt: false,
                trustServerCertificate: true,
            },
        } as DataSourceOptions);

        expect(params.driverOptions).toEqual({
            encrypt: false,
            trustServerCertificate: true,
        });
    });

    it('should omit the driver specific options if there are none', () => {
        const params = buildConnectionParams({
            type: 'postgres',
            host: 'localhost',
        } as DataSourceOptions);

        expect(params.driverOptions).toBeUndefined();
    });

    it('should build params from a connection url', () => {
        const params = buildConnectionParams({
            type: 'postgres',
            url: 'postgres://admin:secret@localhost:5432/app',
        } as DataSourceOptions);

        expect(params.host).toEqual('localhost');
        expect(params.port).toEqual(5432);
        expect(params.user).toEqual('admin');
        expect(params.password).toEqual('secret');
        expect(params.database).toEqual('app');
    });

    it('should build params from the replication master', () => {
        const params = buildConnectionParams({
            type: 'mysql',
            replication: {
                master: {
                    host: 'master.db',
                    port: 3306,
                    username: 'root',
                    password: 'secret',
                    database: 'app',
                },
                slaves: [],
            },
        } as DataSourceOptions);

        expect(params.host).toEqual('master.db');
        expect(params.database).toEqual('app');
    });

    it('should build params for mongodb options', () => {
        const params = buildConnectionParams({
            type: 'mongodb',
            host: 'localhost',
            port: 27017,
            database: 'app',
        } as DataSourceOptions);

        expect(params.database).toEqual('app');
        expect(params.port).toEqual(27017);
    });

    it('should fall back to the extra record for charset options', () => {
        const params = buildConnectionParams({
            type: 'postgres',
            database: 'app',
            extra: { characterSet: 'UTF8' },
        } as DataSourceOptions);

        expect(params.characterSet).toEqual('UTF8');
        expect(params.extra).toEqual({ characterSet: 'UTF8' });
    });
});
