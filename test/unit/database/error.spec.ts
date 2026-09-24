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
} from '../../../src';
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
        ['mysql', { code: 'ER_DUP_ENTRY', errno: 1062 }, UNIQUE],
        ['mysql', { code: 'ER_NO_REFERENCED_ROW_2', errno: 1452 }, FOREIGN_KEY],
        ['mysql', { code: 'ER_ROW_IS_REFERENCED_2', errno: 1451 }, FOREIGN_KEY],
        ['mysql', { code: 'ER_LOCK_DEADLOCK', errno: 1213 }, LOCK],
        ['mysql', { code: 'ER_LOCK_WAIT_TIMEOUT', errno: 1205 }, LOCK],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_UNIQUE' }, UNIQUE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }, UNIQUE],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }, FOREIGN_KEY],
        ['better-sqlite3', { code: 'SQLITE_CONSTRAINT_CHECK' }, NONE],
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
        ['mongodb', { code: 11000 }, UNIQUE],
    ])('should classify %s %j', (_driver, shape, expected) => {
        expect(classify(shape)).toEqual(expected);
        expect(classify(wrap(shape))).toEqual(expected);
        expect(classify({ driverError: shape })).toEqual(expected);
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
    });
});
