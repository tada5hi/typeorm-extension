import type { DataSourceOptions, QueryRunner } from 'typeorm';
import { readCatalogue, useSource } from './catalogue';
import type { CatalogueStatement } from './types';

/**
 * One catalogue row: the options of a table typeorm does not model.
 */
type TableRow = {
    table: string,
    options?: string | null,
};

/**
 * The statement listing the table options typeorm does not model, or undefined for a driver
 * without any: a mariadb table `WITH SYSTEM VERSIONING` (`SYSTEM VERSIONED`), an mssql temporal
 * table or its history table.
 */
export function buildTableStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): CatalogueStatement | undefined {
    switch (type) {
        case 'mysql':
        case 'mariadb': {
            return {
                sql: 'SELECT table_name AS `table`, CASE WHEN table_type = \'SYSTEM VERSIONED\' THEN \'SYSTEM VERSIONED\' END AS `options` ' +
                    'FROM information_schema.tables WHERE table_schema = DATABASE()',
                parameters: [],
            };
        }
        case 'mssql': {
            return {
                sql: 'SELECT t.name AS [table], CASE WHEN t.temporal_type <> 0 THEN t.temporal_type_desc END AS [options] ' +
                    `FROM sys.tables t WHERE t.schema_id = SCHEMA_ID(${schema ? '@0' : ''})`,
                parameters: schema ? [schema] : [],
            };
        }
        default: {
            return undefined;
        }
    }
}

/**
 * The options of each table, null for none.
 */
export function normalizeTableRows(rows: TableRow[]): Map<string, string | null> {
    return new Map(rows.map((row) => [row.table, row.options || null]));
}

/**
 * Read the table options of the given tables, or undefined when the driver has no reader.
 */
export async function readNativeTables(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, string | null> | undefined> {
    const { type, schema } = useSource(queryRunner);

    return readCatalogue(queryRunner, tables, buildTableStatement(type, schema), normalizeTableRows);
}
