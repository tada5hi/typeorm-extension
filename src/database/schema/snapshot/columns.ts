import type { DataSourceOptions, QueryRunner } from 'typeorm';

/**
 * One catalogue row: a generated (computed) column with its expression, or an identity column.
 */
type GeneratedRow = {
    table: string,
    column: string,
    expression?: string | null,
    generated?: string | null,
    identity?: string | null,
};

type NativeGenerated = {
    expression: string | null,
    generatedType: string | null,
    /**
     * `ALWAYS` or `BY DEFAULT`, undefined where the driver reader does not read it (mysql, mssql).
     */
    identity?: string | null,
};

/**
 * The statement listing the generated and identity columns of the current schema, or undefined
 * for a driver without a reader.
 *
 * typeorm takes the expression of a generated column from its metadata table, not from the server:
 * a column created by raw DDL reads as an empty expression, a column changed by raw DDL keeps the
 * expression typeorm recorded. The server's own expression replaces it. Oracle's identity
 * generation (ALWAYS, BY DEFAULT) is read too, which typeorm leaves out there (and on cockroachdb);
 * a hidden oracle column (the expression of a function-based index) is left out.
 */
export function buildGeneratedStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            return {
                sql: [
                    'SELECT t.relname AS "table", a.attname AS "column",',
                    'CASE WHEN a.attgenerated <> \'\' THEN pg_catalog.pg_get_expr(d.adbin, d.adrelid) END AS "expression",',
                    'CASE a.attgenerated WHEN \'s\' THEN \'STORED\' WHEN \'v\' THEN \'VIRTUAL\' END AS "generated",',
                    'CASE a.attidentity WHEN \'a\' THEN \'ALWAYS\' WHEN \'d\' THEN \'BY DEFAULT\' END AS "identity"',
                    'FROM pg_catalog.pg_attribute a',
                    'JOIN pg_catalog.pg_class t ON t.oid = a.attrelid',
                    'JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace',
                    'LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum',
                    `WHERE n.nspname = ${schema ? '$1' : 'current_schema()'} AND a.attnum > 0 AND NOT a.attisdropped`,
                    'AND (a.attgenerated <> \'\' OR a.attidentity <> \'\')',
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            // extra holds DEFAULT_GENERATED for an expression default, whose expression is no generated one
            return {
                sql: [
                    'SELECT table_name AS `table`, column_name AS `column`, generation_expression AS `expression`,',
                    'CASE WHEN extra LIKE \'%STORED GENERATED%\' THEN \'STORED\' ELSE \'VIRTUAL\' END AS `generated`',
                    'FROM information_schema.columns',
                    'WHERE table_schema = DATABASE() AND (extra LIKE \'%STORED GENERATED%\' OR extra LIKE \'%VIRTUAL GENERATED%\')',
                ].join(' '),
                parameters: [],
            };
        }
        case 'mssql': {
            return {
                sql: [
                    'SELECT t.name AS [table], c.name AS [column], c.definition AS [expression],',
                    'CASE WHEN c.is_persisted = 1 THEN \'STORED\' ELSE \'VIRTUAL\' END AS [generated]',
                    'FROM sys.computed_columns c',
                    'JOIN sys.tables t ON t.object_id = c.object_id',
                    `WHERE t.schema_id = SCHEMA_ID(${schema ? '@0' : ''})`,
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'oracle': {
            // data_default is a LONG: selected as is, never compared or unioned
            return {
                sql: [
                    'SELECT c.table_name AS "table", c.column_name AS "column",',
                    'CASE WHEN c.virtual_column = \'YES\' THEN \'VIRTUAL\' END AS "generated", c.data_default AS "expression",',
                    'i.generation_type AS "identity"',
                    'FROM user_tab_cols c',
                    'LEFT JOIN user_tab_identity_cols i ON i.table_name = c.table_name AND i.column_name = c.column_name',
                    'WHERE c.hidden_column = \'NO\' AND (c.virtual_column = \'YES\' OR i.column_name IS NOT NULL)',
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
 * Whether the reader of the driver reads the identity generation.
 */
export function readsGeneratedIdentity(type: DataSourceOptions['type']): boolean {
    return type === 'postgres' || type === 'cockroachdb' || type === 'oracle';
}

/**
 * Fold generated column rows per table and column. An expression is trimmed (oracle pads it);
 * the identity is kept only where the driver reads it (postgres, cockroachdb, oracle).
 */
export function normalizeGeneratedRows(
    type: DataSourceOptions['type'],
    rows: GeneratedRow[],
): Map<string, Map<string, NativeGenerated>> {
    const result = new Map<string, Map<string, NativeGenerated>>();
    const identity = readsGeneratedIdentity(type);

    for (const row of rows) {
        const columns = result.get(row.table) ?? new Map<string, NativeGenerated>();
        const generated = row.generated ?? null;

        result.set(row.table, columns);
        columns.set(row.column, {
            expression: generated && typeof row.expression === 'string' ? row.expression.trim() : null,
            generatedType: generated,
            ...(identity ? { identity: row.identity ?? null } : {}),
        });
    }

    return result;
}

/**
 * Read the generated and identity columns of the given tables, or undefined when the driver
 * has no reader (typeorm's values stay then).
 */
export async function readNativeGenerated(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, Map<string, NativeGenerated>> | undefined> {
    const { options } = queryRunner.connection;
    const statement = buildGeneratedStatement(options.type, (options as { schema?: string }).schema);

    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as GeneratedRow[];
    const wanted = new Set(tables);

    return normalizeGeneratedRows(options.type, rows.filter((row) => wanted.has(row.table)));
}
