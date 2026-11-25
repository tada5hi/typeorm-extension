import { describe, expect, it } from 'vitest';
import type { SchemaSnapshot, SchemaSnapshotColumn, SchemaSnapshotTable } from '../../../../../src';
import {
    SchemaSnapshotError,
    assertSchemaSnapshotsEqual,
    compareSchemaSnapshots,
} from '../../../../../src';

function column(name: string, overrides: Partial<SchemaSnapshotColumn> = {}): SchemaSnapshotColumn {
    return {
        name,
        type: 'integer',
        length: null,
        precision: null,
        scale: null,
        isNullable: false,
        default: null,
        isGenerated: false,
        generationStrategy: null,
        generatedType: null,
        asExpression: null,
        charset: null,
        collation: null,
        isUnsigned: false,
        enum: null,
        ...overrides,
    };
}

function table(name: string, overrides: Partial<SchemaSnapshotTable> = {}): SchemaSnapshotTable {
    return {
        name,
        columns: [column('id'), column('name', { type: 'varchar' })],
        primaryKey: { columns: ['id'] },
        indices: [],
        uniques: [],
        checks: [],
        foreignKeys: [],
        ...overrides,
    };
}

function snapshot(tables: SchemaSnapshotTable[] = [], views: SchemaSnapshot['views'] = []): SchemaSnapshot {
    return { tables, views };
}

describe('database/schema/snapshot/compare', () => {
    it('equal snapshots have no differences', () => {
        expect(compareSchemaSnapshots(snapshot([table('user')]), snapshot([table('user')]))).toEqual([]);
    });

    it('reports a missing and an extra table', () => {
        const differences = compareSchemaSnapshots(
            snapshot([table('a')]),
            snapshot([table('b')]),
        );

        expect(differences.map((d) => [d.path, d.kind])).toEqual([
            ['tables.a', 'missing'],
            ['tables.b', 'extra'],
        ]);
    });

    it('reports a changed column property with expected and actual', () => {
        const differences = compareSchemaSnapshots(
            snapshot([table('user')]),
            snapshot([table('user', { columns: [column('id'), column('name', { type: 'text' })] })]),
        );

        expect(differences).toEqual([
            {
                path: 'tables.user.columns.name.type',
                kind: 'changed',
                expected: 'varchar',
                actual: 'text',
            },
        ]);
    });

    it('reports missing, extra and changed columns', () => {
        const differences = compareSchemaSnapshots(
            snapshot([table('user')]),
            snapshot([table('user', { columns: [column('id', { enum: ['b', 'a'] }), column('age')] })]),
        );

        expect(differences.map((d) => [d.path, d.kind])).toEqual([
            ['tables.user.columns.age', 'extra'],
            ['tables.user.columns.id.enum', 'changed'],
            ['tables.user.columns.name', 'missing'],
        ]);
    });

    it('reports a renamed index', () => {
        const differences = compareSchemaSnapshots(
            snapshot([table('user', {
                indices: [{
                    name: 'IDX_a',
                    columns: ['name'],
                    isUnique: false,
                    where: null,
                    kind: null,
                    definition: null,
                }],
            })]),
            snapshot([table('user', {
                indices: [{
                    name: 'IDX_b',
                    columns: ['name'],
                    isUnique: false,
                    where: null,
                    kind: null,
                    definition: null,
                }],
            })]),
        );

        expect(differences.map((d) => [d.path, d.kind])).toEqual([
            ['tables.user.indices.IDX_a', 'missing'],
            ['tables.user.indices.IDX_b', 'extra'],
        ]);
    });

    it('keys unnamed constraints by columns or expression and reports changes', () => {
        const differences = compareSchemaSnapshots(
            snapshot([table('user', {
                uniques: [{ columns: ['a', 'b'] }],
                checks: [{ expression: 'x > 0' }],
                primaryKey: { columns: ['id'] },
                foreignKeys: [{
                    columns: ['r'],
                    referencedTable: 'role',
                    referencedColumns: ['id'],
                    onDelete: null,
                    onUpdate: null,
                }],
            })]),
            snapshot([table('user', {
                uniques: [{ columns: ['a', 'b'], name: 'x' }],
                checks: [{ expression: 'x > 1' }],
                primaryKey: { columns: ['id', 'name'] },
                foreignKeys: [{
                    columns: ['r'],
                    referencedTable: 'role',
                    referencedColumns: ['id'],
                    onDelete: 'CASCADE',
                    onUpdate: null,
                }],
            })]),
        );

        expect(differences.map((d) => [d.path, d.kind])).toEqual([
            ['tables.user.checks.x > 0', 'missing'],
            ['tables.user.checks.x > 1', 'extra'],
            ['tables.user.foreignKeys.r', 'changed'],
            ['tables.user.primaryKey', 'changed'],
            ['tables.user.uniques.a,b', 'missing'],
            ['tables.user.uniques.x', 'extra'],
        ]);
        expect(differences[3]).toEqual({
            path: 'tables.user.primaryKey',
            kind: 'changed',
            expected: { columns: ['id'] },
            actual: { columns: ['id', 'name'] },
        });
    });

    it('reports views', () => {
        const differences = compareSchemaSnapshots(
            snapshot([], [
                {
                    name: 'a',
                    expression: 'select 1',
                    materialized: false,
                },
                {
                    name: 'b',
                    expression: 'select 1',
                    materialized: false,
                },
            ]),
            snapshot([], [
                {
                    name: 'b',
                    expression: 'select 2',
                    materialized: false,
                },
                {
                    name: 'c',
                    expression: 'select 1',
                    materialized: false,
                },
            ]),
        );

        expect(differences.map((d) => [d.path, d.kind])).toEqual([
            ['views.a', 'missing'],
            ['views.b', 'changed'],
            ['views.c', 'extra'],
        ]);
    });

    it('ignores the order of columns, indices and foreign keys', () => {
        const index = (name: string) => ({
            name,
            columns: [name],
            isUnique: false,
            where: null,
            kind: null,
            definition: null,
        });
        const foreignKey = (name: string) => ({
            name,
            columns: [name],
            referencedTable: 'role',
            referencedColumns: ['id'],
            onDelete: null,
            onUpdate: null,
        });

        const one = table('user', {
            columns: [column('id'), column('name')],
            indices: [index('a'), index('b')],
            foreignKeys: [foreignKey('a'), foreignKey('b')],
        });
        const two = table('user', {
            columns: [column('name'), column('id')],
            indices: [index('b'), index('a')],
            foreignKeys: [foreignKey('b'), foreignKey('a')],
        });

        expect(compareSchemaSnapshots(snapshot([one]), snapshot([two]))).toEqual([]);
    });

    describe('duplicate keys', () => {
        const index = (isUnique: boolean) => ({
            columns: ['a', 'b'],
            isUnique,
            where: null,
            kind: null,
            definition: null,
        });

        it('reports a missing unique index sharing columns with another index', () => {
            const differences = compareSchemaSnapshots(
                snapshot([table('user', { indices: [index(false), index(true)] })]),
                snapshot([table('user', { indices: [index(false)] })]),
            );

            expect(differences).toEqual([
                {
                    path: 'tables.user.indices.a,b#0',
                    kind: 'missing',
                    expected: index(true),
                },
            ]);
        });

        it('ignores the order of duplicates', () => {
            expect(compareSchemaSnapshots(
                snapshot([table('user', { indices: [index(false), index(true)] })]),
                snapshot([table('user', { indices: [index(true), index(false)] })]),
            )).toEqual([]);
        });

        it('reports an extra duplicate', () => {
            const differences = compareSchemaSnapshots(
                snapshot([table('user', { checks: [{ expression: 'x > 0' }] })]),
                snapshot([table('user', { checks: [{ expression: 'x > 0' }, { expression: 'x > 0' }] })]),
            );

            expect(differences).toEqual([
                {
                    path: 'tables.user.checks.x > 0#0',
                    kind: 'extra',
                    actual: { expression: 'x > 0' },
                },
            ]);
        });
    });

    it('assertSchemaSnapshotsEqual throws SchemaSnapshotError listing every difference', () => {
        const expected = snapshot([table('a'), table('b')]);
        const actual = snapshot([table('b', { columns: [column('id')] })]);

        expect(() => assertSchemaSnapshotsEqual(expected, expected)).not.toThrow();

        let error: unknown;

        try {
            assertSchemaSnapshotsEqual(expected, actual);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(SchemaSnapshotError);

        const { differences, message } = error as SchemaSnapshotError;

        expect(differences).toHaveLength(2);
        expect(message).toContain('tables.a');
        expect(message).toContain('tables.b.columns.name');
        expect(message.split('\n')).toHaveLength(3);
    });
});
