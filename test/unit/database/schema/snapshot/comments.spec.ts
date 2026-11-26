import { describe, expect, it } from 'vitest';
import {
    buildCommentStatement,
    normalizeCommentRows,
    readNativeComments,
} from '../../../../../src/database/schema/snapshot/comments';
import { createDataSource } from '../../../../data/typeorm/factory';

describe('database/schema/snapshot/comments', () => {
    it('reads the comments of cockroachdb, mssql and oracle and binds the schema', () => {
        const cockroach = buildCommentStatement('cockroachdb', 'app');

        expect(cockroach?.sql).toContain('FROM pg_catalog.pg_description d');
        expect(cockroach?.sql).toContain('n.nspname = $1');
        expect(cockroach?.parameters).toEqual(['app']);
        expect(buildCommentStatement('cockroachdb')?.sql).toContain('current_schema()');

        const mssql = buildCommentStatement('mssql', 'app');

        expect(mssql?.sql).toContain('ep.name = \'MS_Description\'');
        expect(mssql?.sql).toContain('SCHEMA_ID(@0)');
        expect(mssql?.parameters).toEqual(['app']);

        expect(buildCommentStatement('oracle')?.sql).toContain('FROM user_col_comments');
    });

    it('returns undefined where typeorm reads the comments', async () => {
        for (const type of ['postgres', 'mysql', 'mariadb', 'better-sqlite3'] as const) {
            expect(buildCommentStatement(type)).toBeUndefined();
        }

        const dataSource = createDataSource();

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            expect(await readNativeComments(queryRunner, ['user'])).toBeUndefined();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });

    it('folds table and column comments and treats an empty one as none', () => {
        const result = normalizeCommentRows([
            {
                table: 't',
                column: null,
                comment: 'the t',
            },
            {
                table: 't',
                column: 'a',
                comment: 'the a',
            },
            {
                table: 't',
                column: 'b',
                comment: '',
            },
            {
                table: 'u',
                column: null,
                comment: '',
            },
        ]);

        expect(result.get('t')).toEqual({ comment: 'the t', columns: new Map([['a', 'the a']]) });
        expect(result.get('u')).toEqual({ comment: null, columns: new Map() });
    });
});
