import type { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import { MigrationPlanError } from '../../../errors';

/**
 * The statement listing the base tables of the current schema (database for mysql),
 * unqualified, or undefined for a driver without one.
 */
export function buildUserTablesStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            return {
                // pg_tables, not information_schema: the latter hides tables the role has no privilege on
                sql: `SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = ${schema ? '$1' : 'current_schema()'}`,
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            // information_schema only shows tables the user holds a privilege on
            return {
                // mariadb reports a table WITH SYSTEM VERSIONING as SYSTEM VERSIONED
                sql: 'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ' +
                    'AND table_type IN (\'BASE TABLE\', \'SYSTEM VERSIONED\')',
                parameters: [],
            };
        }
        case 'better-sqlite3': {
            return {
                sql: 'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT GLOB \'sqlite_*\'',
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

/**
 * The tables of the current schema: `listed` is the full catalogue listing, `names` leaves out
 * `ignoreTables` and the migrations and metadata tables.
 *
 * @throws MigrationPlanError
 */
export async function readUserTableNames(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    ignoreTables: string[] = [],
): Promise<{
    listed: string[],
    names: string[],
    metadataTable: string
}> {
    const { options } = dataSource;
    const metadataTable = (options as { metadataTableName?: string }).metadataTableName ?? 'typeorm_metadata';

    const skip = new Set<string>([
        ...ignoreTables,
        options.migrationsTableName ?? 'migrations',
        metadataTable,
    ]);

    const listed = await listUserTableNames(queryRunner);

    return {
        listed,
        names: listed.filter((name) => !skip.has(name)),
        metadataTable,
    };
}
