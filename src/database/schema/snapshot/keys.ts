import type { DataSourceOptions, QueryRunner } from 'typeorm';

/**
 * One catalogue row: a column of a primary key or unique constraint, in key order.
 */
type KeyRow = {
    table: string,
    name: string,
    kind: string,
    column: string,
    deferrable?: string | null,
};

type NativeKey = {
    name: string,
    columns: string[],
    deferrable: string | null,
};

type NativeKeys = {
    primary?: NativeKey,
    uniques: Map<string, NativeKey>,
};

/**
 * The statement listing the primary key and unique constraint columns of the current schema
 * (database for mysql) in key order, or undefined for a driver without a native reader.
 *
 * Postgres follows `pg_constraint.conkey`. Mysql and mariadb follow `seq_in_index` of the
 * `PRIMARY` index: a unique constraint there is a unique index, which the index reader keeps in order.
 */
export function buildKeyStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres': {
            return {
                sql: [
                    'SELECT cl.relname AS "table", c.conname AS "name", c.contype::text AS "kind", a.attname AS "column",',
                    'CASE WHEN NOT c.condeferrable THEN NULL WHEN c.condeferred THEN \'INITIALLY DEFERRED\' ELSE \'INITIALLY IMMEDIATE\' END AS "deferrable"',
                    'FROM pg_catalog.pg_constraint c',
                    'JOIN pg_catalog.pg_class cl ON cl.oid = c.conrelid',
                    'JOIN pg_catalog.pg_namespace n ON n.oid = cl.relnamespace',
                    'CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)',
                    'JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum',
                    `WHERE c.contype IN ('p', 'u') AND n.nspname = ${schema ? '$1' : 'current_schema()'}`,
                    'ORDER BY cl.relname, c.conname, k.ord',
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            return {
                sql: [
                    'SELECT table_name AS `table`, index_name AS `name`, \'p\' AS `kind`, column_name AS `column`, NULL AS `deferrable`',
                    'FROM information_schema.statistics',
                    'WHERE table_schema = DATABASE() AND index_name = \'PRIMARY\'',
                    'ORDER BY table_name, seq_in_index',
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
 * Fold key rows (in key order) into the primary key and the unique constraints per table.
 */
export function normalizeKeyRows(rows: KeyRow[]): Map<string, NativeKeys> {
    const result = new Map<string, NativeKeys>();

    for (const row of rows) {
        const keys = result.get(row.table) ?? { uniques: new Map<string, NativeKey>() };

        result.set(row.table, keys);

        let key = row.kind === 'p' ? keys.primary : keys.uniques.get(row.name);

        if (!key) {
            key = {
                name: row.name,
                columns: [],
                deferrable: row.deferrable ?? null,
            };

            if (row.kind === 'p') {
                keys.primary = key;
            } else {
                keys.uniques.set(row.name, key);
            }
        }

        key.columns.push(row.column);
    }

    return result;
}

/**
 * Read the primary keys and unique constraints of the given tables in key order, or undefined
 * when the driver has no native reader (the key columns are sorted then).
 */
export async function readNativeKeys(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, NativeKeys> | undefined> {
    const { options } = queryRunner.connection;
    const statement = buildKeyStatement(options.type, (options as { schema?: string }).schema);

    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as KeyRow[];
    const wanted = new Set(tables);

    return normalizeKeyRows(rows.filter((row) => wanted.has(row.table)));
}
