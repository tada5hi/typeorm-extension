import { describe, expect, it } from 'vitest';
import {
    buildGeneratedStatement,
    normalizeGeneratedRows,
    readNativeGenerated,
} from '../../../../../src/database/schema/snapshot/columns';
import { createDataSource } from '../../../../data/typeorm/factory';

describe('database/schema/snapshot/columns', () => {
    it('reads the generated and identity columns from the catalogue of each driver', () => {
        const postgres = buildGeneratedStatement('postgres', 'app');

        expect(postgres?.sql).toContain('pg_catalog.pg_get_expr(d.adbin, d.adrelid)');
        expect(postgres?.sql).toContain('a.attidentity');
        expect(postgres?.parameters).toEqual(['app']);
        expect(buildGeneratedStatement('cockroachdb')?.sql).toContain('current_schema()');

        // an expression default (DEFAULT_GENERATED) is no generated column
        expect(buildGeneratedStatement('mysql')?.sql).toContain('extra LIKE \'%STORED GENERATED%\' OR extra LIKE \'%VIRTUAL GENERATED%\'');
        expect(buildGeneratedStatement('mariadb')?.sql).toBe(buildGeneratedStatement('mysql')?.sql);

        expect(buildGeneratedStatement('mssql', 'app')?.sql).toContain('FROM sys.computed_columns c');
        expect(buildGeneratedStatement('mssql', 'app')?.parameters).toEqual(['app']);

        const oracle = buildGeneratedStatement('oracle')?.sql;

        expect(oracle).toContain('user_tab_identity_cols');
        expect(oracle).toContain('c.hidden_column = \'NO\'');
    });

    it('returns undefined for better-sqlite3', async () => {
        expect(buildGeneratedStatement('better-sqlite3')).toBeUndefined();

        const dataSource = createDataSource();

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            expect(await readNativeGenerated(queryRunner, ['user'])).toBeUndefined();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });

    it('folds rows per column, trims the expression and keeps the identity where it is read', () => {
        const oracle = normalizeGeneratedRows('oracle', [
            {
                table: 'T',
                column: 'B',
                generated: 'VIRTUAL',
                expression: '"A"+1 ',
                identity: null,
            },
            {
                table: 'T',
                column: 'ID',
                generated: null,
                expression: '"SYSTEM"."ISEQ$$_1".nextval',
                identity: 'ALWAYS',
            },
        ]);

        expect(oracle.get('T')?.get('B')).toEqual({
            expression: '"A"+1',
            generatedType: 'VIRTUAL',
            identity: null,
        });
        expect(oracle.get('T')?.get('ID')).toEqual({
            expression: null,
            generatedType: null,
            identity: 'ALWAYS',
        });

        const mssql = normalizeGeneratedRows('mssql', [{
            table: 't',
            column: 'b',
            generated: 'STORED',
            expression: '([a]+(1))',
        }]);

        expect(mssql.get('t')?.get('b')).toEqual({ expression: '([a]+(1))', generatedType: 'STORED' });
    });
});
