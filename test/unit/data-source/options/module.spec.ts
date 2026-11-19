import {
    buildDataSourceOptions,
    hasDataSource,
    hasDataSourceOptions,
    setDataSourceOptions,
    unsetDataSource,
    useDataSource,
} from '../../../../src';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resetEnv } from '../../../../src/env';
import { dataSource } from '../../../data/typeorm/data-source';

describe('src/data-source/options', () => {
    it('should set and use data-source options', async () => {
        setDataSourceOptions(dataSource.options);

        expect(hasDataSourceOptions()).toBeTruthy();
        expect(hasDataSource()).toBeFalsy();

        const instance = await useDataSource();

        expect(instance.options).toEqual(dataSource.options);

        unsetDataSource();
    });

    it('should build data-source options', async () => {
        const options = await buildDataSourceOptions({ directory: 'test/data/typeorm' });

        expect(options).toBeDefined();
        expect(options.type).toEqual('better-sqlite3');
        expect(options.database).toBeDefined();
        expect(options.extra).toBeDefined();
    });

    it('should not transform the discovery directory when preserving file paths', async () => {
        // 'src' in the directory would be rewritten to 'dist' by the
        // compiled-mode path transform, so discovery only succeeds when
        // preserveFilePaths reaches the find step.
        const options = await buildDataSourceOptions({
            directory: 'test/data/typeorm/src',
            preserveFilePaths: true,
        });

        expect(options).toBeDefined();
        expect(options.type).toEqual('better-sqlite3');
    });

    it('should use the env driver over file options whose driver package is missing', async () => {
        const saved = process.env.DB_TYPE;

        process.env.DB_TYPE = 'better-sqlite3';
        resetEnv();

        try {
            const options = await buildDataSourceOptions({
                directory: path.join(import.meta.dirname, '..', '..', '..', 'data', 'typeorm', 'find'),
                dataSourceName: 'options-missing-driver',
            });

            expect(options.type).toEqual('better-sqlite3');
        } finally {
            if (typeof saved === 'undefined') {
                delete process.env.DB_TYPE;
            } else {
                process.env.DB_TYPE = saved;
            }

            resetEnv();
        }
    });

    it('should name the accepted export shapes when nothing is found', async () => {
        const keys = ['DB_TYPE', 'DB_URL', 'TYPEORM_CONNECTION', 'TYPEORM_URL'];
        const saved = keys.map((key) => process.env[key]);

        keys.forEach((key) => delete process.env[key]);
        resetEnv();

        try {
            await expect(buildDataSourceOptions({ directory: path.join(import.meta.dirname, '..', '..', '..', 'data', 'entity') })).rejects.toThrow(/could not be located\/loaded.*a default export function without parameters.*DataSourceOptions/);
        } finally {
            keys.forEach((key, index) => {
                if (typeof saved[index] === 'string') {
                    process.env[key] = saved[index];
                }
            });
            resetEnv();
        }
    });
});
