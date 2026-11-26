import { describe, expect, it } from 'vitest';
import {
    buildConstraintStatement,
    normalizeConstraintRows,
    readNativeConstraints,
} from '../../../../../src/database/schema/snapshot/constraints';
import { createDataSource } from '../../../../data/typeorm/factory';

describe('database/schema/snapshot/constraints', () => {
    it('reads every mssql key, foreign key and check constraint with its key order and binds the schema', () => {
        const bound = buildConstraintStatement('mssql', 'app');

        expect(bound?.sql).toContain('FROM sys.key_constraints kc');
        expect(bound?.sql).toContain('FROM sys.foreign_keys fk');
        expect(bound?.sql).toContain('FROM sys.check_constraints cc');
        expect(bound?.sql).toContain('is_system_named');
        expect(bound?.sql).toContain('ORDER BY [table], [name], [position]');
        expect(bound?.sql.match(/SCHEMA_ID\(@0\)/g)).toHaveLength(3);
        expect(bound?.parameters).toEqual(['app']);
        expect(buildConstraintStatement('mssql')?.sql).toContain('SCHEMA_ID()');
    });

    it('reads oracle constraints with generated names and leaves out generated NOT NULL checks', () => {
        const { sql, parameters } = buildConstraintStatement('oracle') as { sql: string, parameters: string[] };

        expect(sql).toContain('c.generated = \'GENERATED NAME\'');
        expect(sql).toContain('JOIN all_cons_columns rc ON rc.owner = c.r_owner');
        expect(sql).toContain('NOT (c.generated = \'GENERATED NAME\' AND REGEXP_LIKE(c.search_condition_vc');
        expect(parameters).toEqual([]);
    });

    it('returns undefined for a driver without a constraint reader', async () => {
        for (const type of ['postgres', 'cockroachdb', 'mysql', 'mariadb', 'better-sqlite3'] as const) {
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
