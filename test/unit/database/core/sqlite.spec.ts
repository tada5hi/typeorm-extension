import path from 'node:path';
import { OptionsError } from '../../../../src/errors';
import {
    SQLiteDialect,
    resolveSQLiteDatabasePath,
} from '../../../../src/database/core';
import { MemoryFileSystem } from '../../../data/database';

describe('src/database/core/sqlite', () => {
    it('should verify the database directory on create', async () => {
        const fs = new MemoryFileSystem();
        fs.writableDirectories.add(path.join('/cwd', 'writable'));

        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.create({
            params: { database: path.join('writable', 'db.sqlite') },
            ifNotExist: true,
        });
    });

    it('should fail on create when the directory is not writable', async () => {
        const fs = new MemoryFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await expect(dialect.create({
            params: { database: path.join('writable', 'db.sqlite') },
            ifNotExist: true,
        })).rejects.toThrow('not writable');
    });

    it('should throw when no database is defined', async () => {
        const dialect = new SQLiteDialect(new MemoryFileSystem(), '/cwd');

        await expect(dialect.create({
            params: {},
            ifNotExist: true,
        })).rejects.toThrow(OptionsError);

        await expect(dialect.drop({
            params: {},
            ifExist: true,
        })).rejects.toThrow(OptionsError);
    });

    it('should remove the database file on drop', async () => {
        const filePath = path.join('/cwd', 'writable', 'db.sqlite');

        const fs = new MemoryFileSystem();
        fs.files.add(filePath);

        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.drop({
            params: { database: path.join('writable', 'db.sqlite') },
            ifExist: true,
        });

        expect(fs.removed).toEqual([filePath]);
    });

    it('should not remove anything when the file is missing or ifExist is unset', async () => {
        const filePath = path.join('/cwd', 'writable', 'db.sqlite');

        const fs = new MemoryFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.drop({
            params: { database: path.join('writable', 'db.sqlite') },
            ifExist: true,
        });

        fs.files.add(filePath);

        await dialect.drop({
            params: { database: path.join('writable', 'db.sqlite') },
            ifExist: false,
        });

        expect(fs.removed).toEqual([]);
    });

    it('should resolve relative and absolute database paths', () => {
        expect(resolveSQLiteDatabasePath('db.sqlite', '/cwd'))
            .toEqual(path.join('/cwd', 'db.sqlite'));

        const absolute = path.resolve('/data', 'db.sqlite');
        expect(resolveSQLiteDatabasePath(absolute, '/cwd')).toEqual(absolute);
    });
});
