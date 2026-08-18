import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DriverError, OptionsError } from '../../../../src/errors';
import {
    SQLiteDialect,
    resolveSQLiteDatabasePath,
} from '../../../../src/database/core';
import { MemoryFileSystem } from '../../../data/database';

const database = path.join('writable', 'db.sqlite');
const filePath = path.join('/cwd', 'writable', 'db.sqlite');

const createFileSystem = () => {
    const fs = new MemoryFileSystem();
    fs.writableDirectories.add(path.join('/cwd', 'writable'));

    return fs;
};

describe('src/database/core/sqlite', () => {
    it('should create the database file', async () => {
        const fs = createFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.create({
            params: { database },
            ifNotExist: false,
        });

        expect(fs.files.has(filePath)).toBeTruthy();
    });

    it('should keep an existing database file with the exist guard', async () => {
        const fs = createFileSystem();
        fs.files.add(filePath);

        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.create({
            params: { database },
            ifNotExist: true,
        });

        expect(fs.files.has(filePath)).toBeTruthy();
    });

    it('should fail on create when the database file already exists', async () => {
        const fs = createFileSystem();
        fs.files.add(filePath);

        const dialect = new SQLiteDialect(fs, '/cwd');

        await expect(dialect.create({
            params: { database },
            ifNotExist: false,
        })).rejects.toThrow('already exists');
    });

    it('should fail on create when the directory is not writable', async () => {
        const fs = new MemoryFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await expect(dialect.create({
            params: { database },
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

    it('should remove the database file on drop, even without the exist guard', async () => {
        const fs = createFileSystem();
        fs.files.add(filePath);

        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.drop({
            params: { database },
            ifExist: false,
        });

        expect(fs.removed).toEqual([filePath]);
    });

    it('should ignore a missing database file with the exist guard', async () => {
        const fs = createFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await dialect.drop({
            params: { database },
            ifExist: true,
        });

        expect(fs.removed).toEqual([]);
    });

    it('should fail on drop when the database file is missing', async () => {
        const fs = createFileSystem();
        const dialect = new SQLiteDialect(fs, '/cwd');

        await expect(dialect.drop({
            params: { database },
            ifExist: false,
        })).rejects.toThrow(DriverError);
    });

    it('should resolve relative and absolute database paths', () => {
        expect(resolveSQLiteDatabasePath('db.sqlite', '/cwd'))
            .toEqual(path.join('/cwd', 'db.sqlite'));

        const absolute = path.resolve('/data', 'db.sqlite');
        expect(resolveSQLiteDatabasePath(absolute, '/cwd')).toEqual(absolute);
    });
});
