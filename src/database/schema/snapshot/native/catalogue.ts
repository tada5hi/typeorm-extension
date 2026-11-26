import type { DataSourceOptions, QueryRunner } from 'typeorm';
import type { CatalogueStatement } from './types';

/**
 * Whether a catalogue flag is set: drivers answer a bit as boolean, number or string.
 */
export function flag(value: unknown): boolean {
    return value === true || Number(value) === 1;
}

/**
 * The value with its name in front, or without one for an empty name.
 */
export function named<T extends object>(name: string | null | undefined, value: T): T & { name?: string } {
    return name ? { name, ...value } : value;
}

/**
 * Append a value to the list of a key.
 */
export function push<T>(map: Map<string, T[]>, key: string, value: T): void {
    const list = map.get(key);

    if (list) {
        list.push(value);
    } else {
        map.set(key, [value]);
    }
}

/**
 * Group rows (one per part) by table and name, in row order.
 */
export function groupByName<T extends { table: string, name: string }>(rows: T[]): T[][] {
    const groups = new Map<string, T[]>();

    for (const row of rows) {
        push(groups, `${row.table}\0${row.name}`, row);
    }

    return groups.values().toArray();
}

/**
 * The driver and the configured schema of a query runner.
 */
export function useSource(queryRunner: QueryRunner): { type: DataSourceOptions['type'], schema?: string } {
    const { options } = queryRunner.connection;

    return { type: options.type, schema: (options as { schema?: string }).schema };
}

/**
 * Run a catalogue statement and normalize the rows of the given tables, or undefined
 * without a statement (the driver has no reader).
 */
export async function readCatalogue<R extends { table: string }, T>(
    queryRunner: QueryRunner,
    tables: string[],
    statement: CatalogueStatement | undefined,
    normalize: (rows: R[]) => Map<string, T>,
): Promise<Map<string, T> | undefined> {
    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as R[];
    const wanted = new Set(tables);

    return normalize(rows.filter((row) => wanted.has(row.table)));
}

/**
 * The (upper-case) columns of an `information_schema` table on mysql or mariadb, empty when the
 * server lacks the table: the optional columns differ by server and version.
 */
export async function readInformationSchemaColumns(queryRunner: QueryRunner, table: string): Promise<Set<string>> {
    const columns = await queryRunner.query(
        'SELECT column_name AS `name` FROM information_schema.columns ' +
        'WHERE table_schema = \'information_schema\' AND table_name = ?',
        [table],
    ) as { name: string }[];

    return new Set(columns.map((column) => String(column.name).toUpperCase()));
}
