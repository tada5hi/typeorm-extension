import type { DataSourceOptions, QueryRunner } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import type { UserTablesStatement } from './types';

/**
 * The statement listing the base tables of the current schema (database for mysql),
 * unqualified, or undefined for a driver without one.
 */
export function buildUserTablesStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): UserTablesStatement | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            return {
                sql: `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ${schema ? '$1' : 'current_schema()'} AND table_type = 'BASE TABLE'`,
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            return {
                sql: 'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = \'BASE TABLE\'',
                parameters: [],
            };
        }
        case 'better-sqlite3': {
            return {
                sql: 'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\'',
                parameters: [],
            };
        }
        case 'mssql': {
            return {
                sql: `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ${schema ? '@0' : 'SCHEMA_NAME()'} AND TABLE_TYPE = 'BASE TABLE'`,
                parameters: schema ? [schema] : [],
            };
        }
        case 'oracle': {
            return {
                sql: 'SELECT table_name AS "name" FROM user_tables',
                parameters: [],
            };
        }
        default: {
            return undefined;
        }
    }
}

/**
 * Names of the tables in the current schema, read from the catalogue
 * (queryRunner.getTables() lists foreign schemas and needs the metadata table on mysql).
 *
 * @throws MigrationPlanError
 */
export async function listUserTableNames(queryRunner: QueryRunner): Promise<string[]> {
    const { options } = queryRunner.connection;
    const statement = buildUserTablesStatement(
        options.type,
        (options as { schema?: string }).schema,
    );

    if (!statement) {
        throw MigrationPlanError.driverNotSupported(options.type);
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as { name?: string, NAME?: string }[];

    return rows.map((row) => (row.name ?? row.NAME) as string);
}
