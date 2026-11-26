import { describe, expect, it } from 'vitest';
import {
    buildColumnStatement,
    normalizeColumnRows,
    readNativeColumns,
    readOnUpdateClauses,
} from '../../../../../../src/database/schema/snapshot/native/columns';
import { createDataSource } from '../../../../../data/typeorm/factory';

describe('database/schema/snapshot/native/columns', () => {
    it('binds the schema where the driver has schemas', () => {
        expect(buildColumnStatement('postgres', 'app')?.parameters).toEqual(['app']);
        expect(buildColumnStatement('cockroachdb')?.parameters).toEqual([]);
        expect(buildColumnStatement('mssql', 'app')?.parameters).toEqual(['app']);
        expect(buildColumnStatement('oracle')?.parameters).toEqual([]);
        expect(buildColumnStatement('mongodb')).toBeUndefined();
    });

    it('folds oracle rows: identity and DEFAULT ON NULL, a padded expression, an invisible column', () => {
        const result = normalizeColumnRows('oracle', [
            {
                table: 'T',
                column: 'ID',
                generated: null,
                expression: '"TEX"."ISEQ$$_1".nextval',
                identity: 'BY DEFAULT',
                defaultOnNull: 1,
            },
            {
                table: 'T',
                column: 'A',
                generated: null,
                expression: '5',
                identity: null,
                defaultOnNull: 1,
            },
            {
                table: 'T',
                column: 'V',
                generated: 'VIRTUAL',
                expression: '"A"+1 ',
                identity: null,
                defaultOnNull: 0,
                options: 'INVISIBLE',
            },
        ]).get('T');

        expect(result?.get('ID')).toEqual({
            expression: null,
            generatedType: null,
            identity: 'BY DEFAULT ON NULL',
            defaultOnNull: false,
            options: null,
        });
        expect(result?.get('A')).toEqual({
            expression: null,
            generatedType: null,
            identity: null,
            defaultOnNull: true,
            options: null,
        });
        expect(result?.get('V')).toEqual({
            expression: '"A"+1',
            generatedType: 'VIRTUAL',
            identity: null,
            defaultOnNull: false,
            options: 'INVISIBLE',
        });
    });

    it('leaves out the columns the server adds and the identity where it is not read', () => {
        const cockroach = normalizeColumnRows('cockroachdb', [
            {
                table: 't',
                column: 'a',
                options: null,
                system: 0,
            },
            {
                table: 't',
                column: 'rowid',
                options: 'NOT VISIBLE',
                system: 1,
            },
        ]);

        expect([...(cockroach.get('t')?.keys() ?? [])]).toEqual(['a']);

        const mssql = normalizeColumnRows('mssql', [{
            table: 't',
            column: 'b',
            generated: 'STORED',
            expression: '([a]+(1))',
            options: 'SPARSE',
        }]);

        expect(mssql.get('t')?.get('b')).toEqual({
            expression: '([a]+(1))',
            generatedType: 'STORED',
            defaultOnNull: false,
            options: 'SPARSE',
        });
    });

    it('reads the ON UPDATE clause of each column of a cockroachdb statement', () => {
        const clauses = readOnUpdateClauses([
            'CREATE TABLE public.rvy (',
            '\tid INT8 NOT NULL,',
            '\ta INT8 NOT VISIBLE NULL DEFAULT 1:::INT8 ON UPDATE 2:::INT8,',
            '\t"b c" STRING NULL ON UPDATE \'x, y\':::STRING,',
            '\tCONSTRAINT rvy_pkey PRIMARY KEY (id ASC)',
            ')',
        ].join('\n'));

        expect(clauses).toEqual(new Map([['a', '2:::INT8'], ['b c', '\'x, y\':::STRING']]));
    });

    it('lists every better-sqlite3 column and marks a generated one', async () => {
        const dataSource = createDataSource();

        await dataSource.initialize();
        await dataSource.query('CREATE TABLE "gen" ("a" integer, "b" integer GENERATED ALWAYS AS ("a" + 1) VIRTUAL)');

        const queryRunner = dataSource.createQueryRunner();

        try {
            const columns = (await readNativeColumns(queryRunner, ['gen']))?.get('gen');

            expect([...(columns?.keys() ?? [])]).toEqual(['a', 'b']);
            expect(columns?.get('b')?.generatedType).toBe('VIRTUAL');
            expect(columns?.get('a')?.generatedType).toBeNull();
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });
});
