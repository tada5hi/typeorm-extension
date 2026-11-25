import { describe, expect, it } from 'vitest';
import {
    buildKeyStatement,
    normalizeKeyRows,
    readNativeKeys,
} from '../../../../../src/database/schema/snapshot/keys';
import { createDataSource } from '../../../../data/typeorm/factory';

describe('database/schema/snapshot/keys', () => {
    it('reads postgres keys in conkey order and binds the schema', () => {
        const bound = buildKeyStatement('postgres', 'app');

        expect(bound?.sql).toContain('unnest(c.conkey) WITH ORDINALITY');
        expect(bound?.sql).toContain('ORDER BY cl.relname, c.conname, k.ord');
        expect(bound?.sql).toContain('c.contype IN (\'p\', \'u\')');
        expect(bound?.sql).toContain('n.nspname = $1');
        expect(bound?.parameters).toEqual(['app']);
        expect(buildKeyStatement('postgres')?.sql).toContain('current_schema()');
    });

    it('reads the mysql and mariadb primary key in seq_in_index order', () => {
        for (const type of ['mysql', 'mariadb'] as const) {
            const statement = buildKeyStatement(type);

            expect(statement?.sql).toContain('index_name = \'PRIMARY\'');
            expect(statement?.sql).toContain('ORDER BY table_name, seq_in_index');
        }
    });

    it('returns undefined for a driver without a key reader', async () => {
        expect(buildKeyStatement('better-sqlite3')).toBeUndefined();
        expect(buildKeyStatement('cockroachdb')).toBeUndefined();

        const dataSource = createDataSource();

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            expect(await readNativeKeys(queryRunner, ['user'])).toBeUndefined();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });

    it('keeps the row order of the key columns', () => {
        const keys = normalizeKeyRows([
            {
                table: 't',
                name: 'PK_t',
                kind: 'p',
                column: 'b',
                deferrable: null,
            },
            {
                table: 't',
                name: 'PK_t',
                kind: 'p',
                column: 'a',
                deferrable: null,
            },
            {
                table: 't',
                name: 'UQ_t',
                kind: 'u',
                column: 'd',
                deferrable: 'INITIALLY DEFERRED',
            },
            {
                table: 't',
                name: 'UQ_t',
                kind: 'u',
                column: 'c',
                deferrable: 'INITIALLY DEFERRED',
            },
            {
                table: 'u',
                name: 'PRIMARY',
                kind: 'p',
                column: 'id',
            },
        ]);

        expect(keys.get('t')?.primary).toEqual({
            name: 'PK_t',
            columns: ['b', 'a'],
            deferrable: null,
        });
        expect(keys.get('t')?.uniques.get('UQ_t')).toEqual({
            name: 'UQ_t',
            columns: ['d', 'c'],
            deferrable: 'INITIALLY DEFERRED',
        });
        expect(keys.get('u')?.primary?.columns).toEqual(['id']);
        expect(keys.get('u')?.uniques.size).toBe(0);
    });
});
