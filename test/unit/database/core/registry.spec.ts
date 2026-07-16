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
    'postgres', 'cockroachdb', 'mysql', 'mssql', 'oracle', 'mongodb', 'better-sqlite3',
];

const optionsFor = (type: string) => ({
    type,
    host: 'localhost',
    database: 'app',
} as DataSourceOptions);

describe('src/database/registry', () => {
    it('should provide an entry for every dialect', () => {
        for (let i = 0; i < names.length; i++) {
            const entry = useDatabaseDialectEntry(names[i]);

            expect(entry).toBeDefined();
            expect(entry.dialect).toBeDefined();

            const params = entry.buildParams(optionsFor(names[i]));
            expect(params.database).toEqual('app');

            if (entry.buildServerPort) {
                const port = entry.buildServerPort(optionsFor(names[i]), params);
                expect(typeof port.connect).toEqual('function');
            }

            if (entry.buildMongoPort) {
                const port = entry.buildMongoPort(optionsFor(names[i]), params);
                expect(typeof port.connect).toEqual('function');
            }
        }
    });

    it('should resolve every supported driver type', () => {
        for (let i = 0; i < names.length; i++) {
            expect(resolveDatabaseDialectName(names[i])).toEqual(names[i]);
        }

        expect(resolveDatabaseDialectName('mariadb')).toEqual('mysql');
    });

    it('should run the sqlite dialect with default rejecting server ports', async () => {
        const fs = new MemoryFileSystem();
        fs.writableDirectories.add('/data');

        await executeDatabaseCreate('better-sqlite3', {
            options: optionsFor('better-sqlite3'),
            ifNotExist: true,
            synchronize: false,
        }, { fs, cwd: '/data' });

        fs.files.add('/data/app');

        await executeDatabaseDrop('better-sqlite3', {
            options: optionsFor('better-sqlite3'),
            ifExist: true,
        }, { fs, cwd: '/data' });

        expect(fs.removed).toEqual(['/data/app']);
    });
});
