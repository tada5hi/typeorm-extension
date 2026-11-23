import { describe, expect, it } from 'vitest';
import { buildUserTablesStatement } from '../../../../../src';

describe('src/database/schema/migration/tables', () => {
    it('should scope postgres to the current or configured schema', () => {
        expect(buildUserTablesStatement('postgres')).toEqual({
            sql: expect.stringContaining('table_schema = current_schema() AND table_type = \'BASE TABLE\''),
            parameters: [],
        });
        expect(buildUserTablesStatement('cockroachdb', 'app')).toEqual({
            sql: expect.stringContaining('table_schema = $1'),
            parameters: ['app'],
        });
    });

    it('should scope mysql to the database', () => {
        expect(buildUserTablesStatement('mariadb')?.sql).toContain('table_schema = DATABASE()');
        expect(buildUserTablesStatement('mysql')?.sql).toContain('BASE TABLE');
    });

    it('should skip internal sqlite tables', () => {
        expect(buildUserTablesStatement('better-sqlite3')?.sql).toContain('NOT LIKE \'sqlite_%\'');
    });

    it('should scope mssql and oracle', () => {
        expect(buildUserTablesStatement('mssql')?.sql).toContain('SCHEMA_NAME()');
        expect(buildUserTablesStatement('mssql', 'app')?.parameters).toEqual(['app']);
        expect(buildUserTablesStatement('oracle')?.sql).toContain('user_tables');
    });

    it('should have no statement for other drivers', () => {
        expect(buildUserTablesStatement('mongodb')).toBeUndefined();
    });
});
