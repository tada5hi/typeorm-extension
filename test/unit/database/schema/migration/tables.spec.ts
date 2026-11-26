import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { buildUserTablesStatement, listUserTableNames } from '../../../../../src/database/schema/migration/tables';

describe('src/database/schema/migration/tables', () => {
    it('should scope postgres to the current or configured schema', () => {
        expect(buildUserTablesStatement('postgres')).toEqual({
            sql: expect.stringContaining('pg_catalog.pg_tables WHERE schemaname = current_schema()'),
            parameters: [],
        });
        expect(buildUserTablesStatement('cockroachdb', 'app')).toEqual({
            sql: expect.stringContaining('schemaname = $1'),
            parameters: ['app'],
        });
    });

    it('should scope mysql to the database', () => {
        expect(buildUserTablesStatement('mariadb')?.sql).toContain('table_schema = DATABASE()');
        expect(buildUserTablesStatement('mysql')?.sql).toContain('BASE TABLE');
        // a mariadb table WITH SYSTEM VERSIONING is a user table too
        expect(buildUserTablesStatement('mariadb')?.sql).toContain('table_type IN (\'BASE TABLE\', \'SYSTEM VERSIONED\')');
    });

    it('should skip internal sqlite tables', () => {
        expect(buildUserTablesStatement('better-sqlite3')?.sql).toContain('NOT GLOB \'sqlite_*\'');
    });

    it('should scope mssql and oracle', () => {
        expect(buildUserTablesStatement('mssql')?.sql).toContain('SCHEMA_NAME()');
        expect(buildUserTablesStatement('mssql', 'app')?.parameters).toEqual(['app']);
        expect(buildUserTablesStatement('oracle')?.sql).toContain('user_tables');
    });

    it('should have no statement for other drivers', () => {
        expect(buildUserTablesStatement('mongodb')).toBeUndefined();
    });

    it('should keep a user table named like an internal one and hide the internal ones', async () => {
        const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:' });

        await dataSource.initialize();

        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.query('CREATE TABLE sqlitecache (id integer)');
            await queryRunner.query('CREATE TABLE counted (id integer PRIMARY KEY AUTOINCREMENT)');

            const rows = await queryRunner.query('SELECT name FROM sqlite_master WHERE name = \'sqlite_sequence\'');

            expect(rows).toHaveLength(1);
            expect((await listUserTableNames(queryRunner)).sort()).toEqual(['counted', 'sqlitecache']);
        } finally {
            await queryRunner.release();
            await dataSource.destroy();
        }
    });
});
