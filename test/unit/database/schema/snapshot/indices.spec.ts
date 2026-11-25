import { describe, expect, it } from 'vitest';
import {
    buildIndexStatement,
    normalizeIndexRows,
    readNativeIndices,
} from '../../../../../src/database/schema/snapshot/indices';
import { createDataSource } from '../../../../data/typeorm/factory';

describe('database/schema/snapshot/indices', () => {
    it('binds the schema of a postgres statement', () => {
        const bound = buildIndexStatement('postgres', 'app');

        expect(bound?.sql).toContain('schemaname = $1');
        expect(bound?.sql).not.toContain('app');
        expect(bound?.parameters).toEqual(['app']);

        const current = buildIndexStatement('cockroachdb');

        expect(current?.sql).toContain('current_schema()');
        expect(current?.parameters).toEqual([]);
    });

    it('excludes constraint-backed indexes on postgres', () => {
        expect(buildIndexStatement('postgres')?.sql).toContain('pg_constraint');
    });

    it('reads the expression column on mysql only', () => {
        const mysql = buildIndexStatement('mysql');

        expect(mysql?.sql).toContain('table_schema = DATABASE()');
        expect(mysql?.sql).toContain('index_name <> \'PRIMARY\'');
        expect(mysql?.sql).toContain('expression AS `expression`');
        expect(buildIndexStatement('mariadb')?.sql).toContain('NULL AS `expression`');
    });

    it('returns undefined for a driver without a reader', async () => {
        expect(buildIndexStatement('better-sqlite3')).toBeUndefined();

        const dataSource = createDataSource();

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            expect(await readNativeIndices(queryRunner, ['user'])).toBeUndefined();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });

    it('strips the schema qualifier from a native index definition', () => {
        const result = normalizeIndexRows('postgres', [
            {
                table: 't',
                name: 'plain',
                definition: 'CREATE INDEX plain ON public.t USING btree (a)',
            },
            {
                table: 't',
                name: 'multi',
                definition: 'CREATE UNIQUE INDEX multi ON "my schema".t USING btree (a, b DESC)',
            },
            {
                table: 't',
                name: 'expr',
                definition: 'CREATE UNIQUE INDEX expr ON public.t USING btree (COALESCE(a, \'\'::text), b)',
            },
            {
                table: 't',
                name: 'part',
                definition: 'CREATE INDEX part ON public.t USING btree (b DESC) WHERE (a IS NOT NULL)',
            },
        ]);

        expect(result.get('t')).toEqual([
            {
                name: 'plain',
                columns: ['a'],
                isUnique: false,
                where: null,
                kind: null,
                definition: 'CREATE INDEX plain ON t USING btree (a)',
            },
            {
                name: 'multi',
                columns: ['a', 'b'],
                isUnique: true,
                where: null,
                kind: null,
                definition: 'CREATE UNIQUE INDEX multi ON t USING btree (a, b DESC)',
            },
            {
                name: 'expr',
                columns: ['b'],
                isUnique: true,
                where: null,
                kind: null,
                definition: 'CREATE UNIQUE INDEX expr ON t USING btree (COALESCE(a, \'\'::text), b)',
            },
            {
                name: 'part',
                columns: ['b'],
                isUnique: false,
                where: '(a IS NOT NULL)',
                kind: null,
                definition: 'CREATE INDEX part ON t USING btree (b DESC) WHERE (a IS NOT NULL)',
            },
        ]);
    });

    it('folds mysql index parts in order and reads uniqueness and kind', () => {
        const result = normalizeIndexRows('mysql', [
            {
                table: 't',
                name: 'u',
                column: 'a',
                unique: 0,
                type: 'BTREE',
            },
            {
                table: 't',
                name: 'u',
                column: 'b',
                unique: 0,
                type: 'BTREE',
            },
            {
                table: 't',
                name: 'e',
                column: null,
                expression: 'coalesce(`a`,\'\')',
                unique: 1,
                type: 'BTREE',
            },
            {
                table: 't',
                name: 'f',
                column: 'body',
                unique: 1,
                type: 'FULLTEXT',
            },
            {
                table: 'o',
                name: 's',
                column: 'g',
                unique: '1',
                type: 'SPATIAL',
            },
        ]);

        expect(result.get('t')).toEqual([
            {
                name: 'u',
                columns: ['a', 'b'],
                isUnique: true,
                where: null,
                kind: null,
                definition: 'a, b',
            },
            {
                name: 'e',
                columns: [],
                isUnique: false,
                where: null,
                kind: null,
                definition: '(coalesce(`a`,\'\'))',
            },
            {
                name: 'f',
                columns: ['body'],
                isUnique: false,
                where: null,
                kind: 'fulltext',
                definition: 'body',
            },
        ]);
        expect(result.get('o')?.[0].kind).toBe('spatial');
    });
});
