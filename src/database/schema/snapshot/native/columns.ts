import type { DataSourceOptions, QueryRunner } from 'typeorm';
import type { CatalogueStatement, NativeColumn } from './types';
import { SchemaSnapshotError } from '../../../../errors/schema-snapshot';
import { flag, readCatalogue, useSource } from './catalogue';
import { tokenize } from './tokens';

/**
 * One catalogue row: one column of a table, with what typeorm misreads or leaves out.
 */
type ColumnRow = {
    table: string,
    column: string,
    expression?: string | null,
    generated?: string | null,
    identity?: string | null,
    defaultOnNull?: number | string | boolean | null,
    options?: string | null,
    /**
     * A column the server adds on its own (cockroachdb `rowid`, a hash shard column), or a
     * hidden column of an sqlite virtual table: not part of the schema.
     */
    system?: number | string | boolean | null,
};

/**
 * Whether the reader of the driver reads the identity generation.
 */
export function readsColumnIdentity(type: DataSourceOptions['type']): boolean {
    return type === 'postgres' || type === 'cockroachdb' || type === 'oracle';
}

/**
 * The statement listing every column of the current schema with its generation, identity and
 * options, or undefined for a driver without a reader. The listing is also the column set the
 * snapshot checks typeorm's against.
 *
 * typeorm takes the expression of a generated column from its metadata table, not from the server:
 * a column created by raw DDL reads as an empty expression, a column changed by raw DDL keeps the
 * expression typeorm recorded. The server's own expression replaces it. Oracle's identity
 * generation and `DEFAULT ON NULL` are read too, which typeorm leaves out there (and the identity
 * on cockroachdb). Columns the server adds on its own are marked `system`; an oracle column the
 * server generates (the expression of a function-based index) is left out.
 */
export function buildColumnStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): CatalogueStatement | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            const cockroach = type === 'cockroachdb';

            return {
                sql: [
                    'SELECT t.relname AS "table", a.attname AS "column",',
                    'CASE WHEN a.attgenerated <> \'\' THEN pg_catalog.pg_get_expr(d.adbin, d.adrelid) END AS "expression",',
                    'CASE a.attgenerated WHEN \'s\' THEN \'STORED\' WHEN \'v\' THEN \'VIRTUAL\' END AS "generated",',
                    'CASE a.attidentity WHEN \'a\' THEN \'ALWAYS\' WHEN \'d\' THEN \'BY DEFAULT\' END AS "identity",',
                    cockroach ?
                        // the implicit primary key (rowid, rowid_1, ...: the sole key column, defaulting to
                        // unique_rowid()) and the column of a hash sharded index are hidden too
                        'CASE WHEN ic.is_hidden = \'YES\' THEN \'NOT VISIBLE\' END AS "options", ' +
                        'CASE WHEN ic.is_hidden = \'YES\' AND ((ic.column_default = \'unique_rowid()\' AND EXISTS (' +
                        'SELECT 1 FROM pg_catalog.pg_constraint pk WHERE pk.conrelid = t.oid AND pk.contype = \'p\' ' +
                        'AND array_length(pk.conkey, 1) = 1 AND pk.conkey[1] = a.attnum)) ' +
                        'OR (a.attname LIKE \'crdb_internal_%_shard_%\' AND a.attgenerated <> \'\')) THEN 1 ELSE 0 END AS "system"' :
                        'NULL AS "options", 0 AS "system"',
                    'FROM pg_catalog.pg_attribute a',
                    'JOIN pg_catalog.pg_class t ON t.oid = a.attrelid',
                    'JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace',
                    'LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum',
                    cockroach ?
                        'LEFT JOIN information_schema.columns ic ' +
                        'ON ic.table_schema = n.nspname AND ic.table_name = t.relname AND ic.column_name = a.attname' :
                        '',
                    `WHERE n.nspname = ${schema ? '$1' : 'current_schema()'} AND t.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped`,
                ].filter((part) => part !== '').join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            // extra holds DEFAULT_GENERATED for an expression default, whose expression is no generated one
            return {
                sql: [
                    'SELECT table_name AS `table`, column_name AS `column`,',
                    'CASE WHEN extra LIKE \'%STORED GENERATED%\' OR extra LIKE \'%VIRTUAL GENERATED%\' THEN generation_expression END AS `expression`,',
                    'CASE WHEN extra LIKE \'%STORED GENERATED%\' THEN \'STORED\' WHEN extra LIKE \'%VIRTUAL GENERATED%\' THEN \'VIRTUAL\' END AS `generated`,',
                    'CASE WHEN extra LIKE \'%INVISIBLE%\' THEN \'INVISIBLE\' END AS `options`',
                    'FROM information_schema.columns',
                    'WHERE table_schema = DATABASE()',
                ].join(' '),
                parameters: [],
            };
        }
        case 'mssql': {
            return {
                sql: [
                    'SELECT t.name AS [table], c.name AS [column], cc.definition AS [expression],',
                    'CASE WHEN cc.object_id IS NULL THEN NULL WHEN cc.is_persisted = 1 THEN \'STORED\' ELSE \'VIRTUAL\' END AS [generated],',
                    'CASE WHEN c.is_column_set = 1 THEN \'COLUMN_SET\' WHEN c.is_sparse = 1 THEN \'SPARSE\' END AS [options]',
                    'FROM sys.columns c',
                    'JOIN sys.tables t ON t.object_id = c.object_id',
                    'LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id',
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
                    'i.generation_type AS "identity", CASE WHEN c.default_on_null = \'YES\' THEN 1 ELSE 0 END AS "defaultOnNull",',
                    'CASE WHEN c.hidden_column = \'YES\' THEN \'INVISIBLE\' END AS "options",',
                    // an unused column (SET UNUSED) has no column id, typeorm still reads it
                    'CASE WHEN c.user_generated = \'NO\' THEN 1 ELSE 0 END AS "system"',
                    'FROM user_tab_cols c',
                    'LEFT JOIN user_tab_identity_cols i ON i.table_name = c.table_name AND i.column_name = c.column_name',
                    'WHERE c.user_generated = \'YES\' OR (c.hidden_column = \'YES\' AND c.virtual_column = \'NO\' AND c.column_id IS NULL)',
                ].join(' '),
                parameters: [],
            };
        }
        case 'better-sqlite3': {
            // hidden: 1 a hidden column of a virtual table, 2 a virtual and 3 a stored generated column
            return {
                sql: [
                    'SELECT m.name AS "table", p.name AS "column",',
                    'CASE p.hidden WHEN 2 THEN \'VIRTUAL\' WHEN 3 THEN \'STORED\' END AS "generated",',
                    'CASE WHEN p.hidden = 1 THEN 1 ELSE 0 END AS "system"',
                    'FROM sqlite_master m JOIN pragma_table_xinfo(m.name) p',
                    'WHERE m.type = \'table\'',
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
 * Fold column rows per table and column; a column the server adds on its own is marked `system`.
 * An expression is trimmed (oracle pads it), an oracle `DEFAULT ON NULL` identity reads
 * `BY DEFAULT ON NULL`, and the identity is kept only where it is read.
 */
export function normalizeColumnRows(
    type: DataSourceOptions['type'],
    rows: ColumnRow[],
): Map<string, Map<string, NativeColumn>> {
    const result = new Map<string, Map<string, NativeColumn>>();
    const identity = readsColumnIdentity(type);

    for (const row of rows) {
        const columns = result.get(row.table) ?? new Map<string, NativeColumn>();

        result.set(row.table, columns);

        if (flag(row.system)) {
            columns.set(row.column, {
                expression: null,
                generatedType: null,
                defaultOnNull: false,
                options: null,
                system: true,
            });

            continue;
        }

        const generated = row.generated ?? null;
        const onNull = flag(row.defaultOnNull);
        const rowIdentity = row.identity && onNull ? `${row.identity} ON NULL` : row.identity ?? null;

        columns.set(row.column, {
            expression: generated && typeof row.expression === 'string' ? row.expression.trim() : null,
            generatedType: generated,
            ...(identity ? { identity: rowIdentity } : {}),
            defaultOnNull: onNull && !row.identity,
            options: row.options ?? null,
        });
    }

    return result;
}

const CLAUSES = new Set(['CONSTRAINT', 'INDEX', 'UNIQUE', 'INVERTED', 'VECTOR', 'FAMILY', 'CHECK', 'PRIMARY', 'FOREIGN']);

/**
 * The `ON UPDATE` expression of each column of a cockroachdb `CREATE TABLE` statement, which
 * prints one column per line and the clause last. The keywords are found outside literals and
 * quoted names; a column line which can not be read for sure throws (fail closed): an unreadable
 * quoting, a missing name, or `ON UPDATE` twice.
 *
 * @throws SchemaSnapshotError
 */
export function readOnUpdateClauses(table: string, statement: string): Map<string, string> {
    const result = new Map<string, string>();

    for (const line of statement.split('\n').filter((part) => /^\s/.test(part))) {
        const text = line.trim().replace(/,$/, '');
        const tokens = tokenize(text);

        if (!tokens) {
            if (/\bON\s+UPDATE\b/i.test(text)) {
                throw SchemaSnapshotError.onUpdateNotReadable(table, text);
            }

            continue;
        }

        const [first] = tokens;

        if (first?.kind === 'word' && CLAUSES.has(first.text.toUpperCase())) {
            continue;
        }

        // ON and UPDATE as words, apart from whitespace
        const words = tokens.map((token, i) => ({ token, i })).filter(({ token }) => token.text.trim() !== '');
        const clauses = words
            .filter(({ token }, j) => token.kind === 'word' && /^ON$/i.test(token.text) &&
                words[j + 1]?.token.kind === 'word' && /^UPDATE$/i.test(words[j + 1].token.text))
            .map(({ i }) => i);

        if (clauses.length === 0) {
            continue;
        }

        if (clauses.length > 1 || (first.kind !== 'word' && first.kind !== 'identifier')) {
            throw SchemaSnapshotError.onUpdateNotReadable(table, text);
        }

        const update = tokens.findIndex((token, i) => i > clauses[0] && /^UPDATE$/i.test(token.text));
        const name = first.kind === 'identifier' ? first.text.slice(1, -1).replace(/""/g, '"') : first.text;

        result.set(name, tokens.slice(update + 1).map((token) => token.text).join('').trim());
    }

    return result;
}

/**
 * Read every column of the given tables, or undefined when the driver has no reader.
 * On cockroachdb the `ON UPDATE` expressions come from the `CREATE TABLE` statements.
 */
export async function readNativeColumns(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, Map<string, NativeColumn>> | undefined> {
    const { type, schema } = useSource(queryRunner);
    const result = await readCatalogue(
        queryRunner,
        tables,
        buildColumnStatement(type, schema),
        (rows: ColumnRow[]) => normalizeColumnRows(type, rows),
    );

    if (!result || type !== 'cockroachdb') {
        return result;
    }

    const statements = await queryRunner.query(
        'SELECT descriptor_name AS "table", create_statement AS "statement" FROM crdb_internal.create_statements ' +
        `WHERE database_name = current_database() AND schema_name = ${schema ? '$1' : 'current_schema()'}`,
        schema ? [schema] : [],
    ) as { table: string, statement: string }[];

    for (const { table, statement } of statements) {
        const clauses = readOnUpdateClauses(table, statement);

        for (const [name, column] of result.get(table) ?? []) {
            column.onUpdate = clauses.get(name) ?? null;
        }
    }

    return result;
}
