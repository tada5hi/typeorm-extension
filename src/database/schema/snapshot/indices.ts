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
    unique?: number | string | boolean,
    type?: string | null,
};

/**
 * The statement listing the indexes of the current schema (database for mysql), or
 * undefined for a driver without a native reader.
 *
 * Postgres lists only indexes that back no constraint (`pg_constraint.conindid`), so the primary
 * key and unique constraints stay with typeorm's `primaryKey` and `uniques`, as typeorm reports them.
 * Mysql has no such split: a unique constraint is a unique index, and typeorm reports it as one too,
 * so every index but `PRIMARY` is listed.
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export function buildIndexStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres':
        case 'cockroachdb': {
            return {
                sql: 'SELECT i.tablename AS "table", i.indexname AS "name", i.indexdef AS "definition" ' +
                    'FROM pg_catalog.pg_indexes i ' +
                    `WHERE i.schemaname = ${schema ? '$1' : 'current_schema()'} ` +
                    'AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c ' +
                    'WHERE c.conindid = (quote_ident(i.schemaname) || \'.\' || quote_ident(i.indexname))::regclass)',
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            return {
                // aliased: mysql 8 returns upper-case column names otherwise; mariadb has no functional indexes
                sql: [
                    'SELECT table_name AS `table`, index_name AS `name`, column_name AS `column`,',
                    `${type === 'mysql' ? 'expression' : 'NULL'} AS \`expression\`,`,
                    'non_unique AS `unique`, index_type AS `type`, seq_in_index AS `seq`',
                    'FROM information_schema.statistics',
                    'WHERE table_schema = DATABASE() AND index_name <> \'PRIMARY\'',
                    'ORDER BY table_name, index_name, seq_in_index',
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
 * A postgres definition loses its `ON <schema>.` qualifier and `isUnique` / `where` come from it;
 * mysql parts are folded per index in `seq_in_index` order (row order).
 *
 * @experimental The schema snapshot API may change in a minor release.
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
            const definition = (row.definition as string).replace(/ ON (?:ONLY )?(?:"[^"]+"|[\w$]+)\./, ' ON ');
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
            definition: parts.map((part) => part.column ?? `(${part.expression})`).join(', '),
        });
    }

    return result;
}

/**
 * Read the indexes of the given tables from the catalogue, or undefined when the driver has
 * no native reader (typeorm's own indices stay then).
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export async function readNativeIndices(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, SchemaSnapshotIndex[]> | undefined> {
    const { options } = queryRunner.connection;
    const statement = buildIndexStatement(options.type, (options as { schema?: string }).schema);

    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as IndexRow[];
    const wanted = new Set(tables);

    return normalizeIndexRows(options.type, rows.filter((row) => wanted.has(row.table)));
}
