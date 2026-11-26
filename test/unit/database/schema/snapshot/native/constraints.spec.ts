import type { QueryRunner } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { SchemaSnapshotError } from '../../../../../../src';
import {
    buildConstraintStatement,
    normalizeConstraintRows,
    readNativeConstraints,
    readsConstraintParts,
} from '../../../../../../src/database/schema/snapshot/native/constraints';
import { createDataSource } from '../../../../../data/typeorm/factory';

describe('database/schema/snapshot/native/constraints', () => {
    it('names the parts each driver reader replaces', () => {
        expect(readsConstraintParts('mssql')).toEqual(['primaryKey', 'uniques', 'checks', 'foreignKeys']);
        expect(readsConstraintParts('oracle')).toEqual(['primaryKey', 'uniques', 'checks', 'foreignKeys']);
        expect(readsConstraintParts('mysql')).toEqual(['checks']);
        expect(readsConstraintParts('mariadb')).toEqual(['checks']);
        expect(readsConstraintParts('postgres')).toEqual([]);
    });

    it('reads mysql and mariadb checks only where the server has them', () => {
        expect(buildConstraintStatement('mysql', undefined, new Set())).toBeUndefined();
        expect(buildConstraintStatement('mariadb', undefined, new Set(['CHECK_CLAUSE']))).toBeUndefined();
        expect(buildConstraintStatement('mariadb', undefined, new Set(['CHECK_CLAUSE', 'TABLE_NAME']))).toBeDefined();
        expect(buildConstraintStatement('mysql', undefined, new Set(['CHECK_CLAUSE']))).toBeDefined();
    });

    it('refuses a mariadb server which does not list its checks with their table', async () => {
        const queryRunner = {
            connection: { options: { type: 'mariadb' } },
            query: async () => [{ name: 'CONSTRAINT_NAME' }, { name: 'CHECK_CLAUSE' }],
        } as unknown as QueryRunner;

        await expect(readNativeConstraints(queryRunner, ['t'])).rejects.toThrow(SchemaSnapshotError);
    });

    it('binds the mssql schema and returns undefined for a driver without a reader', async () => {
        expect(buildConstraintStatement('mssql', 'app')?.parameters).toEqual(['app']);
        expect(buildConstraintStatement('mssql')?.parameters).toEqual([]);

        for (const type of ['postgres', 'cockroachdb', 'better-sqlite3'] as const) {
            expect(buildConstraintStatement(type)).toBeUndefined();
        }

        const dataSource = createDataSource();

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            expect(await readNativeConstraints(queryRunner, ['user'])).toBeUndefined();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });

    it('folds a mysql check with its enforcement and an oracle key with its index and RELY', () => {
        const result = normalizeConstraintRows([
            {
                table: 't',
                name: 'ck',
                kind: 'c',
                expression: '(`a` > 0)',
                options: 'NOT ENFORCED',
            },
            {
                table: 'T',
                name: 'UQ',
                kind: 'u',
                system: 0,
                column: 'A',
                options: 'USING INDEX IX NONUNIQUE RELY',
            },
        ]);

        expect(result.get('t')?.checks).toEqual([{
            name: 'ck',
            expression: '(`a` > 0)',
            definition: 'CHECK ((`a` > 0)) NOT ENFORCED',
        }]);
        expect(result.get('T')?.uniques).toEqual([{
            name: 'UQ',
            columns: ['A'],
            deferrable: null,
            definition: 'UNIQUE (A) USING INDEX IX NONUNIQUE RELY',
        }]);
    });

    it('folds key rows in key order and leaves out a generated name', () => {
        const result = normalizeConstraintRows([
            {
                table: 't',
                name: 'PK__t__3BD0198E',
                kind: 'p',
                system: 1,
                column: 'b',
                descending: 0,
                options: 'CLUSTERED',
            },
            {
                table: 't',
                name: 'PK__t__3BD0198E',
                kind: 'p',
                system: 1,
                column: 'a',
                descending: 1,
                options: 'CLUSTERED',
            },
            {
                table: 't',
                name: 'UQ_t_c',
                kind: 'u',
                system: 0,
                column: 'c',
                options: 'NONCLUSTERED',
            },
        ]);

        expect(result.get('t')).toEqual({
            primaryKey: {
                columns: ['b', 'a'],
                deferrable: null,
                definition: 'PRIMARY KEY (b, a DESC) CLUSTERED',
            },
            uniques: [{
                name: 'UQ_t_c',
                columns: ['c'],
                deferrable: null,
                definition: 'UNIQUE (c) NONCLUSTERED',
            }],
            checks: [],
            foreignKeys: [],
        });
    });

    it('folds foreign key and check rows with their actions and states', () => {
        const result = normalizeConstraintRows([
            {
                table: 'T',
                name: 'FK_T',
                kind: 'f',
                system: 0,
                column: 'A',
                referencedTable: 'P',
                referencedColumn: 'X',
                onDelete: 'SET_NULL',
                onUpdate: 'NO_ACTION',
                options: 'NOT TRUSTED',
            },
            {
                table: 'T',
                name: 'FK_T',
                kind: 'f',
                system: 0,
                column: 'B',
                referencedTable: 'P',
                referencedColumn: 'Y',
                onDelete: 'SET_NULL',
                onUpdate: 'NO_ACTION',
                options: 'NOT TRUSTED',
            },
            {
                table: 'T',
                name: 'SYS_C0001',
                kind: 'f',
                system: 1,
                column: 'A',
                referencedTable: 'P',
                referencedColumn: 'X',
                onDelete: 'CASCADE',
                deferrable: 'INITIALLY DEFERRED',
            },
            {
                table: 'T',
                name: 'SYS_C0002',
                kind: 'c',
                system: 1,
                expression: 'a > 0',
                options: 'DISABLE NOVALIDATE',
            },
        ]);

        expect(result.get('T')).toEqual({
            primaryKey: null,
            uniques: [],
            checks: [{
                expression: 'a > 0',
                definition: 'CHECK (a > 0) DISABLE NOVALIDATE',
            }],
            foreignKeys: [
                {
                    name: 'FK_T',
                    columns: ['A', 'B'],
                    referencedTable: 'P',
                    referencedColumns: ['X', 'Y'],
                    onDelete: 'SET NULL',
                    onUpdate: 'NO ACTION',
                    deferrable: null,
                    definition: 'FOREIGN KEY (A, B) REFERENCES P (X, Y) ON DELETE SET NULL ON UPDATE NO ACTION NOT TRUSTED',
                },
                {
                    columns: ['A'],
                    referencedTable: 'P',
                    referencedColumns: ['X'],
                    onDelete: 'CASCADE',
                    onUpdate: 'NO ACTION',
                    deferrable: 'INITIALLY DEFERRED',
                    definition: 'FOREIGN KEY (A) REFERENCES P (X) ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED',
                },
            ],
        });
    });
});
