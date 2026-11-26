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

        expect(bound?.sql).toContain('n.nspname = $1');
        expect(bound?.sql).not.toContain('app');
        expect(bound?.parameters).toEqual(['app']);

        const current = buildIndexStatement('cockroachdb');

        expect(current?.sql).toContain('current_schema()');
        expect(current?.parameters).toEqual([]);
    });

    it('excludes constraint-backed indexes on postgres', () => {
        const { sql } = buildIndexStatement('postgres') as { sql: string };

        expect(sql).toContain('pg_constraint');
        expect(sql).toContain('c.conindid = ci.oid');
        // a foreign key also sets conindid (to the index it references): that index must stay listed
        expect(sql).toContain('c.contype IN (\'p\', \'u\', \'x\')');
    });

    it('reads the expression column on mysql only', () => {
        const mysql = buildIndexStatement('mysql');

        expect(mysql?.sql).toContain('table_schema = DATABASE()');
        expect(mysql?.sql).toContain('index_name <> \'PRIMARY\'');
        expect(mysql?.sql).toContain('expression AS `expression`');
        expect(buildIndexStatement('mariadb')?.sql).toContain('NULL AS `expression`');
        expect(buildIndexStatement('mariadb')?.sql).toContain('sub_part AS `length`');
    });

    it('reads the direction, visibility and type of mysql and mariadb index parts', () => {
        const mysql = buildIndexStatement('mysql')?.sql;
        const mariadb = buildIndexStatement('mariadb')?.sql;

        expect(mysql).toContain('collation AS `collation`');
        expect(mysql).toContain('(is_visible = \'NO\') AS `invisible`');
        expect(mysql).toContain('index_type AS `type`');
        expect(mariadb).toContain('collation AS `collation`');
        expect(mariadb).toContain('(ignored = \'YES\') AS `invisible`');
    });

    it('selects NULL for a statistics column the server lacks', () => {
        const mysql = buildIndexStatement('mysql', undefined, new Set(['COLLATION']))?.sql;
        const mariadb = buildIndexStatement('mariadb', undefined, new Set(['COLLATION']))?.sql;

        expect(mysql).toContain('NULL AS `expression`');
        expect(mysql).toContain('NULL AS `invisible`');
        expect(mariadb).toContain('NULL AS `invisible`');
        expect(buildIndexStatement('mysql', undefined, new Set(['EXPRESSION', 'IS_VISIBLE']))?.sql)
            .toContain('expression AS `expression`');
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

    it('strips only the qualifier after the index name', () => {
        const result = normalizeIndexRows('postgres', [
            {
                table: 't',
                name: 'q x',
                definition: 'CREATE INDEX "q x" ON public.t USING btree (a) WHERE (a = \'ON public.x\'::text)',
            },
        ]);

        expect(result.get('t')?.[0].definition).toBe('CREATE INDEX "q x" ON t USING btree (a) WHERE (a = \'ON public.x\'::text)');
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
                definition: 'a, b USING BTREE',
            },
            {
                name: 'e',
                columns: [],
                isUnique: false,
                where: null,
                kind: null,
                definition: '(coalesce(`a`,\'\')) USING BTREE',
            },
            {
                name: 'f',
                columns: ['body'],
                isUnique: false,
                where: null,
                kind: 'fulltext',
                definition: 'body USING FULLTEXT',
            },
        ]);
        expect(result.get('o')?.[0].kind).toBe('spatial');
    });

    it('appends the direction, the type and the visibility to a mysql definition', () => {
        const rows = (collation: string | null, type: string, invisible: number | null) => [
            {
                table: 't',
                name: 'd',
                column: 'a',
                collation,
                unique: 1,
                type,
                invisible,
            },
            {
                table: 't',
                name: 'd',
                column: 'b',
                collation: 'A',
                unique: 1,
                type,
                invisible,
            },
        ];

        const plain = normalizeIndexRows('mysql', rows('A', 'BTREE', 0)).get('t')?.[0].definition;

        expect(plain).toBe('a, b USING BTREE');
        expect(normalizeIndexRows('mysql', rows('D', 'BTREE', 0)).get('t')?.[0].definition).toBe('a DESC, b USING BTREE');
        expect(normalizeIndexRows('mysql', rows('A', 'HASH', 0)).get('t')?.[0].definition).toBe('a, b USING HASH');
        expect(normalizeIndexRows('mysql', rows('A', 'BTREE', 1)).get('t')?.[0].definition).toBe('a, b USING BTREE INVISIBLE');
        expect(normalizeIndexRows('mariadb', rows('A', 'BTREE', '1' as any)).get('t')?.[0].definition).toBe('a, b USING BTREE IGNORED');
        expect(normalizeIndexRows('mysql', rows(null, 'BTREE', null)).get('t')?.[0].definition).toBe(plain);
    });

    it('keeps the prefix length of a mysql index part', () => {
        const rows = (length: number | null) => [
            {
                table: 't',
                name: 'p',
                column: 'a',
                length,
                unique: 0,
                type: 'BTREE',
            },
            {
                table: 't',
                name: 'p',
                column: 'b',
                length: null,
                unique: 0,
                type: 'BTREE',
            },
        ];

        const prefixed = normalizeIndexRows('mariadb', rows(10)).get('t')?.[0];
        const shorter = normalizeIndexRows('mariadb', rows(5)).get('t')?.[0];

        expect(prefixed?.definition).toBe('a(10), b USING BTREE');
        expect(prefixed?.columns).toEqual(['a', 'b']);
        expect(shorter?.definition).not.toEqual(prefixed?.definition);
    });

    it('strips the database and schema qualifier of a cockroachdb definition', () => {
        const result = normalizeIndexRows('cockroachdb', [
            {
                table: 't',
                name: 'ix',
                definition: 'CREATE INDEX ix ON defaultdb.public.t USING btree (lower(a) ASC)',
            },
        ]);

        expect(result.get('t')?.[0]).toEqual({
            name: 'ix',
            columns: [],
            isUnique: false,
            where: null,
            kind: null,
            definition: 'CREATE INDEX ix ON t USING btree (lower(a) ASC)',
        });
    });

    it('reads mssql indexes that back no key constraint, keys before included columns', () => {
        const bound = buildIndexStatement('mssql', 'app');

        expect(bound?.sql).toContain('SCHEMA_ID(@0)');
        expect(bound?.sql).toContain('i.is_primary_key = 0 AND i.is_unique_constraint = 0');
        expect(bound?.sql).toContain('i.filter_definition AS [where]');
        expect(bound?.sql).toContain('ORDER BY t.name, i.name, ic.is_included_column, ic.key_ordinal');
        expect(bound?.parameters).toEqual(['app']);
        expect(buildIndexStatement('mssql')?.sql).toContain('SCHEMA_ID()');
    });

    it('reads oracle indexes with their expressions and leaves out constraint and LOB indexes', () => {
        const { sql, parameters } = buildIndexStatement('oracle') as { sql: string, parameters: string[] };

        expect(sql).toContain('LEFT JOIN user_ind_expressions e');
        expect(sql).toContain('c.constraint_type IN (\'P\', \'U\')');
        expect(sql).toContain('i.index_type <> \'LOB\'');
        expect(sql).toContain('ORDER BY i.table_name, i.index_name, ic.column_position');
        expect(parameters).toEqual([]);
    });

    it('folds mssql index parts with direction, included columns, filter and disabled state', () => {
        const result = normalizeIndexRows('mssql', [
            {
                table: 't',
                name: 'ix',
                column: 'b',
                descending: 0,
                included: 0,
                unique: 1,
                type: 'NONCLUSTERED',
                where: '([a] IS NOT NULL)',
                invisible: 0,
            },
            {
                table: 't',
                name: 'ix',
                column: 'a',
                descending: 1,
                included: 0,
                unique: 1,
                type: 'NONCLUSTERED',
                where: '([a] IS NOT NULL)',
                invisible: 0,
            },
            {
                table: 't',
                name: 'ix',
                column: 'c',
                descending: 0,
                included: 1,
                unique: 1,
                type: 'NONCLUSTERED',
                where: '([a] IS NOT NULL)',
                invisible: 0,
            },
            {
                table: 't',
                name: 'off',
                column: 'a',
                descending: false,
                included: false,
                unique: false,
                type: 'CLUSTERED',
                where: null,
                invisible: true,
            },
        ]);

        expect(result.get('t')).toEqual([
            {
                name: 'ix',
                columns: ['b', 'a'],
                isUnique: true,
                where: '([a] IS NOT NULL)',
                kind: null,
                definition: 'NONCLUSTERED (b, a DESC) INCLUDE (c)',
            },
            {
                name: 'off',
                columns: ['a'],
                isUnique: false,
                where: null,
                kind: null,
                definition: 'CLUSTERED (a) DISABLED',
            },
        ]);
    });

    it('folds oracle index parts: an expression part has no column, a descending part keeps it', () => {
        const result = normalizeIndexRows('oracle', [
            {
                table: 'T',
                name: 'IX_F',
                column: 'SYS_NC00005$',
                expression: 'UPPER("LABEL") ',
                descending: 0,
                unique: 1,
                type: 'FUNCTION-BASED NORMAL',
                invisible: 0,
            },
            {
                table: 'T',
                name: 'IX_D',
                column: 'A',
                expression: null,
                descending: 0,
                unique: 0,
                type: 'FUNCTION-BASED NORMAL',
                invisible: 1,
            },
            {
                table: 'T',
                name: 'IX_D',
                column: 'SYS_NC00006$',
                expression: '"B"',
                descending: 1,
                unique: 0,
                type: 'FUNCTION-BASED NORMAL',
                invisible: 1,
            },
        ]);

        expect(result.get('T')).toEqual([
            {
                name: 'IX_F',
                columns: [],
                isUnique: true,
                where: null,
                kind: null,
                definition: 'FUNCTION-BASED NORMAL ((UPPER("LABEL")))',
            },
            {
                name: 'IX_D',
                columns: ['A', 'B'],
                isUnique: false,
                where: null,
                kind: null,
                definition: 'FUNCTION-BASED NORMAL (A, B DESC) INVISIBLE',
            },
        ]);
    });
});
