import type { DataSourceOptions, QueryRunner } from 'typeorm';

/**
 * One catalogue row: a constraint with its key columns in key order (postgres), or one
 * column of the primary key (mysql, mariadb: one row per column, in key order).
 */
type KeyRow = {
    table: string,
    name: string,
    kind: string,
    columns?: string[] | null,
    column?: string | null,
    definition?: string | null,
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
    /**
     * The catalogue definition of each constraint by name (postgres only).
     */
    definitions: Map<string, string>,
};

/**
 * The statement listing the constraints of the current schema (database for mysql), with the
 * primary key and unique constraint columns in key order, or undefined for a driver without a
 * native reader.
 *
 * Postgres lists every primary key, unique, foreign key, check and exclusion constraint with its
 * `pg_get_constraintdef` text and its columns in `pg_constraint.conkey` order. Mysql and mariadb
 * list the `PRIMARY` index in `seq_in_index` order: a unique constraint there is a unique index,
 * which the index reader keeps in order.
 */
export function buildKeyStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'postgres': {
            return {
                sql: [
                    'SELECT cl.relname AS "table", c.conname AS "name", c.contype::text AS "kind",',
                    'ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)',
                    'JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum ORDER BY k.ord) AS "columns",',
                    'pg_catalog.pg_get_constraintdef(c.oid) AS "definition",',
                    'CASE WHEN NOT c.condeferrable THEN NULL WHEN c.condeferred THEN \'INITIALLY DEFERRED\' ELSE \'INITIALLY IMMEDIATE\' END AS "deferrable"',
                    'FROM pg_catalog.pg_constraint c',
                    'JOIN pg_catalog.pg_class cl ON cl.oid = c.conrelid',
                    'JOIN pg_catalog.pg_namespace n ON n.oid = cl.relnamespace',
                    `WHERE c.contype IN ('p', 'u', 'f', 'c', 'x') AND n.nspname = ${schema ? '$1' : 'current_schema()'}`,
                    'ORDER BY cl.relname, c.conname',
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'mysql':
        case 'mariadb': {
            return {
                sql: [
                    'SELECT table_name AS `table`, index_name AS `name`, \'p\' AS `kind`, column_name AS `column`',
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
 * Fold constraint rows into the primary key, the unique constraints (columns in row order)
 * and the constraint definitions per table.
 */
export function normalizeKeyRows(rows: KeyRow[]): Map<string, NativeKeys> {
    const result = new Map<string, NativeKeys>();

    for (const row of rows) {
        const keys = result.get(row.table) ?? { uniques: new Map<string, NativeKey>(), definitions: new Map<string, string>() };

        result.set(row.table, keys);

        if (typeof row.definition === 'string') {
            keys.definitions.set(row.name, row.definition);
        }

        if (row.kind !== 'p' && row.kind !== 'u') {
            continue;
        }

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

        if (row.columns) {
            key.columns.push(...row.columns);
        } else if (row.column) {
            key.columns.push(row.column);
        }
    }

    return result;
}

/**
 * Read the constraints of the given tables (key order, definitions), or undefined when the
 * driver has no native reader (the key columns are sorted then, and no definition is read).
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
