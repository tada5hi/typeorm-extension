import type { DataSourceOptions } from 'typeorm';
import type { DatabaseDialectName } from '../../../../src/database/core';
import {
    resolveDatabaseDialectName,
    useDatabaseDialectEntry,
} from '../../../../src/database/registry';
import {
    executeDatabaseCreate,
    executeDatabaseDrop,
} from '../../../../src/database/methods/execute';
import { MemoryFileSystem } from '../../../data/database';

const names: DatabaseDialectName[] = [
    'postgres', 
    'cockroachdb', 
    'mysql', 
    'mssql', 
    'oracle', 
    'mongodb', 
    'better-sqlite3',
];

const optionsFor = (type: string) => ({
    type,
    host: 'localhost',
    database: 'app',
} as DataSourceOptions);

describe('src/database/registry', () => {
    it('should provide an entry for every dialect', () => {
        for (const name of names) {
            const entry = useDatabaseDialectEntry(name);

            expect(entry).toBeDefined();

            const params = entry.buildParams(optionsFor(name));
            expect(params.database).toEqual('app');

            const dialect = entry.buildDialect(optionsFor(name), params, {});
            expect(typeof dialect.create).toEqual('function');
            expect(typeof dialect.drop).toEqual('function');
        }
    });

    it('should resolve every supported driver type', () => {
        for (const name of names) {
            expect(resolveDatabaseDialectName(name)).toEqual(name);
        }

        expect(resolveDatabaseDialectName('mariadb')).toEqual('mysql');
    });

    it('should run the sqlite dialect through the composition root', async () => {
        const fs = new MemoryFileSystem();
        fs.writableDirectories.add('/data');

        await executeDatabaseCreate('better-sqlite3', {
            options: optionsFor('better-sqlite3'),
            ifNotExist: true,
            synchronize: false,
        }, { fs, cwd: '/data' });

        expect(fs.files.has('/data/app')).toBeTruthy();

        await executeDatabaseDrop('better-sqlite3', {
            options: optionsFor('better-sqlite3'),
            ifExist: true,
        }, { fs, cwd: '/data' });

        expect(fs.removed).toEqual(['/data/app']);
    });
});
