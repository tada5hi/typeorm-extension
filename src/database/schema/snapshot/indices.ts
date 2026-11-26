import type { DataSourceOptions, QueryRunner } from 'typeorm';
import type { SchemaSnapshotIndex } from './types';

/**
 * One catalogue row: an index of a table, one row per index (postgres)
 * or per index part (mysql, mariadb).
 */
type IndexRow = {
    table: string,
    name: string,
    definition?: string | null,
    column?: string | null,
    expression?: string | null,
    length?: number | string | null,
    unique?: number | string | boolean,
    type?: string | null,
    collation?: string | null,
    invisible?: number | string | boolean | null,
    descending?: number | string | boolean | null,
    included?: number | string | boolean | null,
    where?: string | null,
};

/**
 * The columns of `information_schema.statistics` a mysql or mariadb server is assumed to have
 * when the caller does not list them: mysql 8 adds `expression` and `is_visible`, mariadb 10.6 `ignored`.
 */
function defaultStatisticsColumns(type: DataSourceOptions['type']): Set<string> {
    return new Set(type === 'mysql' ? ['EXPRESSION', 'IS_VISIBLE'] : ['IGNORED']);
}

/**
 * The statement listing the indexes of the current schema (database for mysql), or
 * undefined for a driver without a native reader.
 *
 * Postgres lists only indexes that back no primary key, unique or exclusion constraint (`pg_constraint.conindid`
 * with `contype` p, u or x; a foreign key also points at the unique index it references, which must stay
 * listed), so the primary key and unique constraints stay with typeorm's `primaryKey` and `uniques`, as typeorm reports them.
 * Mysql has no such split: a unique constraint is a unique index, and typeorm reports it as one too,
 * so every index but `PRIMARY` is listed. `statistics` names the (upper-case) columns of
 * `information_schema.statistics` the server has; a column it lacks is selected as NULL.
 * Mssql and oracle list the indexes that back no primary key or unique constraint, which the
 * constraint reader reports: typeorm loses their key order, direction, included columns and
 * (oracle) the expression of a function-based index.
 */
export function buildIndexStatement(
    type: DataSourceOptions['type'],
    schema?: string,
    statistics: Set<string> = defaultStatisticsColumns(type),
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            return {
                // pg_index, not pg_indexes: cockroachdb names every primary index `primary`, which no regclass cast resolves
                sql: 'SELECT t.relname AS "table", ci.relname AS "name", pg_catalog.pg_get_indexdef(ci.oid) AS "definition" ' +
                    'FROM pg_catalog.pg_index x ' +
                    'JOIN pg_catalog.pg_class ci ON ci.oid = x.indexrelid ' +
                    'JOIN pg_catalog.pg_class t ON t.oid = x.indrelid ' +
                    'JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace ' +
                    `WHERE n.nspname = ${schema ? '$1' : 'current_schema()'} ` +
                    'AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c ' +
                    'WHERE c.contype IN (\'p\', \'u\', \'x\') AND c.conindid = ci.oid)',
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            let invisible = 'NULL';

            if (statistics.has('IS_VISIBLE')) {
                invisible = '(is_visible = \'NO\')';
            } else if (statistics.has('IGNORED')) {
                invisible = '(ignored = \'YES\')';
            }

            return {
                // aliased: mysql 8 returns upper-case column names otherwise; mariadb has no functional indexes
                sql: [
                    'SELECT table_name AS `table`, index_name AS `name`, column_name AS `column`,',
                    `${statistics.has('EXPRESSION') ? 'expression' : 'NULL'} AS \`expression\`,`,
                    'sub_part AS `length`, non_unique AS `unique`, index_type AS `type`, seq_in_index AS `seq`,',
                    `collation AS \`collation\`, ${invisible} AS \`invisible\``,
                    'FROM information_schema.statistics',
                    'WHERE table_schema = DATABASE() AND index_name <> \'PRIMARY\'',
                    'ORDER BY table_name, index_name, seq_in_index',
                ].join(' '),
                parameters: [],
            };
        }
        case 'mssql': {
            return {
                // the key columns in key order, included columns after them by name; heaps and hypothetical indexes have no definition
                sql: [
                    'SELECT t.name AS [table], i.name AS [name], c.name AS [column], CAST(ic.is_descending_key AS int) AS [descending],',
                    'CAST(ic.is_included_column AS int) AS [included], CAST(i.is_unique AS int) AS [unique], i.type_desc AS [type],',
                    'i.filter_definition AS [where], CAST(i.is_disabled AS int) AS [invisible]',
                    'FROM sys.indexes i',
                    'JOIN sys.tables t ON t.object_id = i.object_id',
                    'JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id',
                    'JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id',
                    `WHERE t.schema_id = SCHEMA_ID(${schema ? '@0' : ''}) AND i.type > 0 AND i.is_hypothetical = 0`,
                    'AND i.is_primary_key = 0 AND i.is_unique_constraint = 0',
                    'ORDER BY t.name, i.name, ic.is_included_column, ic.key_ordinal, ic.index_column_id',
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'oracle': {
            return {
                // an expression part (a descending part too) is a hidden column whose expression user_ind_expressions holds
                sql: [
                    'SELECT i.table_name AS "table", i.index_name AS "name", ic.column_name AS "column", e.column_expression AS "expression",',
                    'CASE WHEN ic.descend = \'DESC\' THEN 1 ELSE 0 END AS "descending", CASE WHEN i.uniqueness = \'UNIQUE\' THEN 1 ELSE 0 END AS "unique",',
                    'i.index_type AS "type", CASE WHEN i.visibility = \'INVISIBLE\' THEN 1 ELSE 0 END AS "invisible"',
                    'FROM user_indexes i',
                    'JOIN user_ind_columns ic ON ic.index_name = i.index_name',
                    'LEFT JOIN user_ind_expressions e ON e.index_name = ic.index_name AND e.column_position = ic.column_position',
                    'WHERE i.index_type <> \'LOB\'',
                    'AND NOT EXISTS (SELECT 1 FROM user_constraints c WHERE c.index_name = i.index_name AND c.constraint_type IN (\'P\', \'U\'))',
                    'ORDER BY i.table_name, i.index_name, ic.column_position',
                ].join(' '),
                parameters: [],
            };
        }
        default: {
            return undefined;
        }
    }
}

function flag(value: number | string | boolean | null | undefined): boolean {
    return value === true || Number(value) === 1;
}

/**
 * Reduce the key list of a postgres index definition to its plain column names. Expression
 * parts contribute no name.
 */
function readPostgresColumns(definition: string): string[] {
    const start = definition.indexOf(' USING ');
    const open = definition.indexOf('(', start);
    let depth = 0;
    const parts: string[] = [];
    let current = '';

    for (let i = open + 1; i < definition.length; i++) {
        const char = definition[i];

        if (char === '(') {
            depth++;
        } else if (char === ')') {
            if (depth === 0) {
                break;
            }

            depth--;
        }

        if (char === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    parts.push(current);

    return parts
        .map((part) => part.trim())
        .map((part) => /^("?)([A-Za-z_][\w$]*)\1(?:\s+(?:ASC|DESC|NULLS\s+(?:FIRST|LAST)|\w+_ops))*$/i.exec(part))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => match[2]);
}

/**
 * Normalize the rows of a native index statement into snapshot indexes per table.
 * A postgres definition loses its `ON <schema>.` qualifier (cockroachdb: `ON <database>.<schema>.`) and `isUnique` / `where` come from it;
 * mysql parts are folded per index in `seq_in_index` order (row order), a prefix part keeps its length (`a(10)`),
 * a descending part gets `DESC`, and the index type and an invisible (mysql) or ignored (mariadb) index follow.
 * Mssql and oracle rows are folded the same way: the definition is the index type, the key parts (an
 * oracle expression part in parentheses, a descending part with `DESC`), the included columns (mssql)
 * and a disabled (mssql) or invisible (oracle) index; `where` is the mssql filter. An expression part
 * contributes no column name.
 */
export function normalizeIndexRows(
    type: DataSourceOptions['type'],
    rows: IndexRow[],
): Map<string, SchemaSnapshotIndex[]> {
    const result = new Map<string, SchemaSnapshotIndex[]>();
    const push = (table: string, index: SchemaSnapshotIndex) => {
        const list = result.get(table) ?? [];

        list.push(index);
        result.set(table, list);
    };

    if (type === 'postgres' || type === 'cockroachdb') {
        for (const row of rows) {
            const definition = (row.definition as string).replace(/^(CREATE (?:UNIQUE )?INDEX (?:"[^"]*"|\S+) ON )(?:ONLY )?(?:(?:"[^"]+"|[\w$]+)\.){1,2}/, '$1');
            const where = /\sWHERE\s(.*)$/s.exec(definition);

            push(row.table, {
                name: row.name,
                columns: readPostgresColumns(definition),
                isUnique: /^CREATE UNIQUE INDEX /i.test(definition),
                where: where ? where[1] : null,
                kind: null,
                definition,
            });
        }

        return result;
    }

    const grouped = new Map<string, IndexRow[]>();

    for (const row of rows) {
        const key = `${row.table}\0${row.name}`;

        grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }

    if (type === 'mssql' || type === 'oracle') {
        for (const parts of grouped.values()) {
            const [first] = parts;
            const keys = parts.filter((part) => !flag(part.included));
            const included = parts.filter((part) => flag(part.included)).map((part) => part.column as string);
            // oracle keeps a descending part as the expression "COLUMN"
            const columnOf = (part: IndexRow) => {
                if (!part.expression) {
                    return part.column as string;
                }

                const match = /^"([^"]+)"$/.exec(part.expression.trim());

                return match ? match[1] : undefined;
            };

            push(first.table, {
                name: first.name,
                columns: keys.map(columnOf).filter((column): column is string => !!column),
                isUnique: flag(first.unique),
                where: first.where || null,
                kind: null,
                definition: `${first.type} (${keys.map((part) => {
                    const value = columnOf(part) ?? `(${(part.expression as string).trim()})`;

                    return flag(part.descending) ? `${value} DESC` : value;
                }).join(', ')})${
                    included.length > 0 ? ` INCLUDE (${included.join(', ')})` : ''
                }${flag(first.invisible) ? ` ${type === 'mssql' ? 'DISABLED' : 'INVISIBLE'}` : ''}`,
            });
        }

        return result;
    }

    for (const parts of grouped.values()) {
        const [first] = parts;
        const kinds: Record<string, 'spatial' | 'fulltext'> = { SPATIAL: 'spatial', FULLTEXT: 'fulltext' };
        const kind = kinds[first.type ?? ''] ?? null;

        push(first.table, {
            name: first.name,
            columns: parts.filter((part) => part.column).map((part) => part.column as string),
            isUnique: Number(first.unique) === 0,
            where: null,
            kind,
            definition: parts.map((part) => {
                let value: string;

                if (!part.column) {
                    value = `(${part.expression})`;
                } else {
                    value = part.length ? `${part.column}(${part.length})` : part.column;
                }

                return part.collation === 'D' ? `${value} DESC` : value;
            }).join(', ') +
                (first.type ? ` USING ${first.type}` : '') +
                (Number(first.invisible) === 1 ? ` ${type === 'mariadb' ? 'IGNORED' : 'INVISIBLE'}` : ''),
        });
    }

    return result;
}

/**
 * Read the indexes of the given tables from the catalogue, or undefined when the driver has
 * no native reader (typeorm's own indices stay then).
 */
export async function readNativeIndices(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, SchemaSnapshotIndex[]> | undefined> {
    const { options } = queryRunner.connection;
    let statistics: Set<string> | undefined;

    if (options.type === 'mysql' || options.type === 'mariadb') {
        // the optional columns differ by server and version
        const columns = await queryRunner.query(
            'SELECT column_name AS `name` FROM information_schema.columns ' +
            'WHERE table_schema = \'information_schema\' AND table_name = \'STATISTICS\'',
        ) as { name: string }[];

        statistics = new Set(columns.map((column) => String(column.name).toUpperCase()));
    }

    const statement = buildIndexStatement(options.type, (options as { schema?: string }).schema, statistics);

    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as IndexRow[];
    const wanted = new Set(tables);

    return normalizeIndexRows(options.type, rows.filter((row) => wanted.has(row.table)));
}
