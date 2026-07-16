import {
    OracleDialect,
    buildOracleConnectString,
} from '../../../../src/database/core';
import { MemoryDatabaseConnector, createMemoryRuntime } from '../../../data/database';

describe('src/database/core/oracle', () => {
    it('should create database', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new OracleDialect();

        await dialect.create({
            params: { database: 'app' },
            ifNotExist: true,
        }, createMemoryRuntime({ connector }));

        expect(connector.sql()).toEqual(['CREATE DATABASE IF NOT EXISTS app']);
        expect(connector.openSessions.size).toEqual(0);
    });

    it('should not connect on drop', async () => {
        const connector = new MemoryDatabaseConnector();
        const dialect = new OracleDialect();

        await dialect.drop({
            params: { database: 'app' },
            ifExist: true,
        }, createMemoryRuntime({ connector }));

        expect(connector.events).toHaveLength(0);
    });

    it('should build the connect string', () => {
        expect(buildOracleConnectString({
            host: 'localhost',
            port: 1521,
            sid: 'xe',
        })).toEqual('(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SID=xe)))');

        expect(buildOracleConnectString({
            host: 'db.example.com',
            serviceName: 'orcl',
        })).toEqual('(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=db.example.com))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=orcl)))');
    });
});
