import type { DataSourceOptions, QueryRunner } from 'typeorm';
import type { CatalogueStatement, NativeComments } from './types';
import { readCatalogue, useSource } from './catalogue';

/**
 * One catalogue row: the comment of a table (`column` null) or of one of its columns.
 */
type CommentRow = {
    table: string,
    column?: string | null,
    comment?: string | null,
};

/**
 * The statement listing the table and column comments of the current schema, or undefined
 * for a driver whose comments typeorm reads (postgres, mysql, mariadb) or which has none.
 *
 * typeorm reads no table comment on cockroachdb and no comment at all on mssql and oracle.
 * Mssql has no comment: the `MS_Description` extended property is the conventional one.
 */
export function buildCommentStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): CatalogueStatement | undefined {
    switch (type) {
        case 'cockroachdb': {
            return {
                sql: [
                    'SELECT t.relname AS "table", a.attname AS "column", d.description AS "comment"',
                    'FROM pg_catalog.pg_description d',
                    'JOIN pg_catalog.pg_class t ON t.oid = d.objoid',
                    'JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace',
                    'LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.objsubid AND d.objsubid > 0',
                    'WHERE d.classoid = \'pg_catalog.pg_class\'::regclass',
                    `AND n.nspname = ${schema ? '$1' : 'current_schema()'}`,
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'mssql': {
            return {
                sql: [
                    'SELECT t.name AS [table], c.name AS [column], CAST(ep.value AS nvarchar(max)) AS [comment]',
                    'FROM sys.extended_properties ep',
                    'JOIN sys.tables t ON t.object_id = ep.major_id',
                    'LEFT JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id AND ep.minor_id > 0',
                    'WHERE ep.class = 1 AND ep.name = \'MS_Description\'',
                    `AND t.schema_id = SCHEMA_ID(${schema ? '@0' : ''})`,
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'oracle': {
            return {
                sql: [
                    'SELECT table_name AS "table", NULL AS "column", comments AS "comment"',
                    'FROM user_tab_comments WHERE table_type = \'TABLE\' AND comments IS NOT NULL',
                    'UNION ALL',
                    'SELECT table_name, column_name, comments',
                    'FROM user_col_comments WHERE comments IS NOT NULL',
                ].join(' '),
                parameters: [],
            };
        }
        default: {
            return undefined;
        }
    }
}

/**
 * Fold comment rows into the table comment and the column comments per table.
 * An empty comment is no comment.
 */
export function normalizeCommentRows(rows: CommentRow[]): Map<string, NativeComments> {
    const result = new Map<string, NativeComments>();

    for (const row of rows) {
        const entry = result.get(row.table) ?? { comment: null, columns: new Map<string, string>() };

        result.set(row.table, entry);

        if (!row.comment) {
            continue;
        }

        if (row.column) {
            entry.columns.set(row.column, row.comment);
        } else {
            entry.comment = row.comment;
        }
    }

    return result;
}

/**
 * Read the table and column comments of the given tables, or undefined when the driver has
 * no comment reader (typeorm's comments stay then).
 */
export async function readNativeComments(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, NativeComments> | undefined> {
    const { type, schema } = useSource(queryRunner);

    return readCatalogue(queryRunner, tables, buildCommentStatement(type, schema), normalizeCommentRows);
}
