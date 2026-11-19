import { DataSource, QueryFailedError } from 'typeorm';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import {
    isDatabaseForeignKeyViolationError,
    isDatabaseLockConflictError,
    isDatabaseUniqueViolationError,
    readDatabaseErrorCode,
} from '../../../src';
import { isDatabaseNotFoundError } from '../../../src/database/error/module';
import { ConstraintChild } from '../../data/entity/constraint-child';
import { ConstraintParent } from '../../data/entity/constraint-parent';

function classify(error: unknown) {
    return {
        unique: isDatabaseUniqueViolationError(error),
        foreignKey: isDatabaseForeignKeyViolationError(error),
        lock: isDatabaseLockConflictError(error),
    };
}

function wrap(driverError: Record<string, any>) : QueryFailedError {
    return new QueryFailedError('INSERT ...', [], Object.assign(new Error(driverError.message ?? 'failed'), driverError));
}

const UNIQUE = {
    unique: true, 
    foreignKey: false, 
    lock: false, 
};
const FOREIGN_KEY = {
    unique: false, 
    foreignKey: true, 
    lock: false, 
};
const LOCK = {
    unique: false, 
    foreignKey: false, 
    lock: true, 
};
const NONE = {
    unique: false, 
    foreignKey: false, 
    lock: false, 
};

describe('src/database/error', () => {
    it.each([
        ['postgres', { code: '23505' }, UNIQUE],
        ['postgres', { code: '23503' }, FOREIGN_KEY],
        ['postgres', { code: '40P01' }, LOCK],
        ['postgres', { code: '40001' }, LOCK],
        ['postgres', { code: '55P03' }, LOCK],
        ['mysql', { code: 'ER_DUP_ENTRY', errno: 1062 }, UNIQUE],
        ['mysql', { code: 'ER_NO_REFERENCED_ROW_2', errno: 1452 }, FOREIGN_KEY],
        ['mysql', { code: 'ER_ROW_IS_REFERENCED_2', errno: 1451 }, FOREIGN_KEY],
        ['mysql', { code: 'ER_LOCK_DEADLOCK', errno: 1213 }, LOCK],
        ['mysql', { code: 'ER_LOCK_WAIT_TIMEOUT', errno: 1205 }, LOCK],
        ['mysql', { code: 'ER_LOCK_NOWAIT', errno: 3572 }, LOCK],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_UNIQUE' }, UNIQUE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }, UNIQUE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }, FOREIGN_KEY],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_CHECK' }, NONE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_TRIGGER', message: 'FOREIGN KEY constraint failed' }, FOREIGN_KEY],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_TRIGGER', message: 'not allowed' }, NONE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_TRIGGER' }, NONE],
        ['mssql', { code: 'EREQUEST', number: 2627 }, UNIQUE],
        ['mssql', { code: 'EREQUEST', number: 2601 }, UNIQUE],
        [
            'mssql',
            {
                code: 'EREQUEST',
                number: 547,
                message: 'The INSERT statement conflicted with the FOREIGN KEY constraint "FK_x".',
            },
            FOREIGN_KEY,
        ],
        [
            'mssql',
            {
                code: 'EREQUEST',
                number: 547,
                message: 'The DELETE statement conflicted with the REFERENCE constraint "FK_x".',
            },
            FOREIGN_KEY,
        ],
        [
            'mssql',
            {
                code: 'EREQUEST',
                number: 547,
                message: 'The INSERT statement conflicted with the CHECK constraint "CK_x".',
            },
            NONE,
        ],
        ['mssql', { code: 'EREQUEST', number: 1205 }, LOCK],
        ['mssql', { code: 'EREQUEST', number: 1222 }, LOCK],
        ['oracle', { code: 'ORA-00001', errorNum: 1 }, UNIQUE],
        ['oracle', { errorNum: 1 }, UNIQUE],
        ['oracle', { code: 'ORA-02291', errorNum: 2291 }, FOREIGN_KEY],
        ['oracle', { code: 'ORA-02292', errorNum: 2292 }, FOREIGN_KEY],
        ['oracle', { code: 'ORA-00060', errorNum: 60 }, LOCK],
        ['oracle', { code: 'ORA-08177', errorNum: 8177 }, LOCK],
        ['oracle', { code: 'ORA-00054', errorNum: 54 }, LOCK],
        ['mongodb', { code: 11000 }, UNIQUE],
    ])('should classify %s %j', (_driver, shape, expected) => {
        expect(classify(shape)).toEqual(expected);
        expect(classify(wrap(shape))).toEqual(expected);
        expect(classify({ driverError: shape })).toEqual(expected);
    });

    it('should read the message of the driver error before the wrapper', () => {
        const error = {
            message: 'Query failed',
            driverError: {
                code: 'EREQUEST',
                number: 547,
                message: 'The INSERT statement conflicted with the FOREIGN KEY constraint "FK_x".',
            },
        };

        expect(classify(error)).toEqual(FOREIGN_KEY);
    });

    it('should classify nothing else', () => {
        expect(classify(undefined)).toEqual(NONE);
        expect(classify(null)).toEqual(NONE);
        expect(classify('23505')).toEqual(NONE);
        expect(classify(new Error('23505'))).toEqual(NONE);
        expect(classify({ code: 'ECONNREFUSED' })).toEqual(NONE);
        expect(classify({ code: 'EREQUEST' })).toEqual(NONE);
    });

    describe('better-sqlite3', () => {
        let dataSource : DataSource;

        beforeAll(async () => {
            dataSource = new DataSource({
                type: 'better-sqlite3',
                database: ':memory:',
                entities: [ConstraintParent, ConstraintChild],
                synchronize: true,
            });
            await dataSource.initialize();
            await dataSource.getRepository(ConstraintParent).insert({ id: 1, name: 'a' });
            await dataSource.getRepository(ConstraintChild).insert({ id: 1, parentId: 1 });

            // ON DELETE / ON UPDATE RESTRICT runs as a trigger in sqlite.
            await dataSource.query('CREATE TABLE "restrict_child" ("id" integer PRIMARY KEY, "parentId" integer REFERENCES "constraint_parent" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT)');
            await dataSource.getRepository(ConstraintParent).insert({ id: 3, name: 'c' });
            await dataSource.query('INSERT INTO "restrict_child" VALUES (1, 3)');
            await dataSource.query('CREATE TRIGGER "guard" BEFORE DELETE ON "constraint_parent" WHEN old."id" = 4 BEGIN SELECT RAISE(ABORT, \'not allowed\'); END');
            await dataSource.getRepository(ConstraintParent).insert({ id: 4, name: 'd' });
        });

        afterAll(async () => {
            await dataSource.destroy();
        });

        it('should classify the errors the driver raises', async () => {
            const parents = dataSource.getRepository(ConstraintParent);
            const children = dataSource.getRepository(ConstraintChild);

            await expect(parents.insert({ id: 2, name: 'a' })).rejects.toSatisfy(isDatabaseUniqueViolationError);
            await expect(parents.insert({ id: 1, name: 'b' })).rejects.toSatisfy(isDatabaseUniqueViolationError);
            await expect(children.insert({ id: 2, parentId: 99 })).rejects.toSatisfy(isDatabaseForeignKeyViolationError);
            await expect(parents.delete({ id: 1 })).rejects.toSatisfy(isDatabaseForeignKeyViolationError);
        });

        it('should classify a RESTRICT foreign key, but not a trigger of its own', async () => {
            const parents = dataSource.getRepository(ConstraintParent);

            await expect(parents.delete({ id: 3 })).rejects.toSatisfy(isDatabaseForeignKeyViolationError);
            await expect(parents.update({ id: 3 }, { id: 30 })).rejects.toSatisfy(isDatabaseForeignKeyViolationError);

            const error = await parents.delete({ id: 4 }).catch((e) => e);

            expect(error).toBeInstanceOf(QueryFailedError);
            expect(classify(error)).toEqual(NONE);
        });
    });

    describe('isDatabaseNotFoundError', () => {
        it('should recognize a missing database on the wrapper and on the driver error', () => {
            expect(isDatabaseNotFoundError({ code: '3D000' })).toBe(true);
            expect(isDatabaseNotFoundError({ driverError: { code: '3D000' }, message: 'x' })).toBe(true);
        });

        it('should reject other errors and non objects', () => {
            expect(isDatabaseNotFoundError({ code: '23505' })).toBe(false);
            expect(isDatabaseNotFoundError(new Error('database "x" does not exist'))).toBe(false);
            expect(isDatabaseNotFoundError(undefined)).toBe(false);
            expect(isDatabaseNotFoundError('3D000')).toBe(false);
        });
    });

    describe('readDatabaseErrorCode', () => {
        it.each([
            [{ code: '23505' }, '23505'],
            [{ code: 'ER_DUP_ENTRY', errno: 1062 }, 'ER_DUP_ENTRY'],
            [{ code: 'SQLITE_CONSTRAINT_UNIQUE' }, 'SQLITE_CONSTRAINT_UNIQUE'],
            [{ code: 'EREQUEST', number: 2627 }, '2627'],
            [{ code: 'ORA-00001', errorNum: 1 }, 'ORA-00001'],
            [{ errorNum: 1 }, '1'],
            [{ code: 11000 }, '11000'],
            [{ code: 'ECONNREFUSED' }, 'ECONNREFUSED'],
            [{ code: 'ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO', errno: 1557 }, 'ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO'],
            [{ errno: 1927 }, '1927'],
        ])('should read %j', (shape, expected) => {
            expect(readDatabaseErrorCode(shape)).toEqual(expected);
            expect(readDatabaseErrorCode(wrap(shape))).toEqual(expected);
            expect(readDatabaseErrorCode({ driverError: shape })).toEqual(expected);
        });

        it('should never return a message or anything else than a plain token', () => {
            expect(readDatabaseErrorCode({ code: 'duplicate key value (name)=(alice)' })).toBeUndefined();
            expect(readDatabaseErrorCode({ code: 'a'.repeat(65) })).toBeUndefined();
            expect(readDatabaseErrorCode({ code: '' })).toBeUndefined();
            expect(readDatabaseErrorCode({ code: 1.5 })).toBeUndefined();
            expect(readDatabaseErrorCode({ code: NaN })).toBeUndefined();
            expect(readDatabaseErrorCode({ code: { toString: () => '23505' } })).toBeUndefined();
            expect(readDatabaseErrorCode(new Error('23505'))).toBeUndefined();
            expect(readDatabaseErrorCode('23505')).toBeUndefined();
            expect(readDatabaseErrorCode(undefined)).toBeUndefined();
            expect(readDatabaseErrorCode(null)).toBeUndefined();
        });

        it('should fall back to the next field when one is no plain token', () => {
            expect(readDatabaseErrorCode({ code: 'not a code', errorNum: 1 })).toEqual('1');
        });

        it('should read the code of an error the driver raises', async () => {
            const dataSource = new DataSource({
                type: 'better-sqlite3',
                database: ':memory:',
                entities: [ConstraintParent, ConstraintChild],
                synchronize: true,
            });

            await dataSource.initialize();

            try {
                const parents = dataSource.getRepository(ConstraintParent);

                await parents.insert({ id: 1, name: 'a' });

                const error = await parents.insert({ id: 1, name: 'b' }).catch((e) => e);

                expect(readDatabaseErrorCode(error)).toEqual('SQLITE_CONSTRAINT_PRIMARYKEY');
            } finally {
                await dataSource.destroy();
            }
        });
    });
});
