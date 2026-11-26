import type { DataSourceOptions, QueryRunner } from 'typeorm';
import type {
    SchemaSnapshotCheck,
    SchemaSnapshotForeignKey,
    SchemaSnapshotTable,
    SchemaSnapshotUnique,
} from './types';

/**
 * One catalogue row: one column of a primary key, unique or foreign key constraint
 * (in key order), or one check constraint.
 */
type ConstraintRow = {
    table: string,
    name: string,
    kind: string,
    system?: number | string | boolean | null,
    column?: string | null,
    descending?: number | string | boolean | null,
    referencedTable?: string | null,
    referencedColumn?: string | null,
    onDelete?: string | null,
    onUpdate?: string | null,
    expression?: string | null,
    deferrable?: string | null,
    options?: string | null,
};

type NativeConstraints = Pick<SchemaSnapshotTable, 'primaryKey' | 'uniques' | 'checks' | 'foreignKeys'>;

/**
 * The statement listing every primary key, unique, foreign key and check constraint of the
 * current schema, or undefined for a driver whose constraints typeorm reads reliably enough
 * (the key readers of keys.ts complete them there).
 *
 * Mssql: typeorm reports key columns in table column order and foreign key columns in no defined
 * order, and leaves out the direction of a key part and whether the key index is clustered.
 * Oracle: typeorm drops every constraint with a system generated name (an unnamed primary key,
 * unique or check), and sorts no key. Both name an unnamed constraint at random (`PK__t__3BD0198E`,
 * `SYS_C009090`), so `system` marks a generated name, which is left out of the snapshot.
 * Oracle's generated NOT NULL checks are left out: the column nullability reports them.
 */
export function buildConstraintStatement(
    type: DataSourceOptions['type'],
    schema?: string,
): { sql: string, parameters: string[] } | undefined {
    switch (type) {
        case 'mssql': {
            const scope = `t.schema_id = SCHEMA_ID(${schema ? '@0' : ''})`;

            return {
                sql: [
                    'SELECT t.name AS [table], kc.name AS [name], LOWER(LEFT(kc.type, 1)) AS [kind], CAST(kc.is_system_named AS int) AS [system],',
                    'c.name AS [column], CAST(ic.is_descending_key AS int) AS [descending], ic.key_ordinal AS [position],',
                    'NULL AS [referencedTable], NULL AS [referencedColumn], NULL AS [onDelete], NULL AS [onUpdate], NULL AS [expression], i.type_desc AS [options]',
                    'FROM sys.key_constraints kc',
                    'JOIN sys.tables t ON t.object_id = kc.parent_object_id',
                    'JOIN sys.indexes i ON i.object_id = kc.parent_object_id AND i.index_id = kc.unique_index_id',
                    'JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0',
                    'JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id',
                    `WHERE ${scope}`,
                    'UNION ALL',
                    'SELECT t.name, fk.name, \'f\', CAST(fk.is_system_named AS int), pc.name, 0, fkc.constraint_column_id,',
                    'rt.name, rc.name, fk.delete_referential_action_desc, fk.update_referential_action_desc, NULL,',
                    'CASE WHEN fk.is_disabled = 1 THEN \'DISABLED\' WHEN fk.is_not_trusted = 1 THEN \'NOT TRUSTED\' ELSE NULL END',
                    'FROM sys.foreign_keys fk',
                    'JOIN sys.tables t ON t.object_id = fk.parent_object_id',
                    'JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id',
                    'JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id',
                    'JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id',
                    'JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id',
                    `WHERE ${scope}`,
                    'UNION ALL',
                    'SELECT t.name, cc.name, \'c\', CAST(cc.is_system_named AS int), NULL, 0, 0, NULL, NULL, NULL, NULL, cc.definition,',
                    'CASE WHEN cc.is_disabled = 1 THEN \'DISABLED\' WHEN cc.is_not_trusted = 1 THEN \'NOT TRUSTED\' ELSE NULL END',
                    'FROM sys.check_constraints cc',
                    'JOIN sys.tables t ON t.object_id = cc.parent_object_id',
                    `WHERE ${scope}`,
                    'ORDER BY [table], [name], [position]',
                ].join(' '),
                parameters: schema ? [schema] : [],
            };
        }
        case 'oracle': {
            // the schema of an oracle session is its user: user_constraints
            const flags = [
                'CASE WHEN c.deferrable = \'DEFERRABLE\' THEN \'INITIALLY \' || c.deferred END AS "deferrable",',
                'CASE WHEN c.status = \'DISABLED\' THEN \'DISABLE\' END || CASE WHEN c.validated = \'NOT VALIDATED\' THEN \' NOVALIDATE\' END AS "options"',
            ].join(' ');
            const system = 'CASE WHEN c.generated = \'GENERATED NAME\' THEN 1 ELSE 0 END AS "system"';

            return {
                sql: [
                    `SELECT c.table_name AS "table", c.constraint_name AS "name", LOWER(c.constraint_type) AS "kind", ${system},`,
                    'cc.column_name AS "column", cc.position AS "position", NULL AS "referencedTable", NULL AS "referencedColumn",',
                    `NULL AS "onDelete", NULL AS "expression", ${flags}`,
                    'FROM user_constraints c',
                    'JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name',
                    'WHERE c.constraint_type IN (\'P\', \'U\')',
                    'UNION ALL',
                    `SELECT c.table_name, c.constraint_name, 'f', ${system},`,
                    'cc.column_name, cc.position, rc.table_name, rc.column_name, c.delete_rule, NULL, ',
                    flags,
                    'FROM user_constraints c',
                    'JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name',
                    'JOIN all_cons_columns rc ON rc.owner = c.r_owner AND rc.constraint_name = c.r_constraint_name AND rc.position = cc.position',
                    'WHERE c.constraint_type = \'R\'',
                    'UNION ALL',
                    `SELECT c.table_name, c.constraint_name, 'c', ${system},`,
                    'NULL, 0, NULL, NULL, NULL, c.search_condition_vc, ',
                    flags,
                    'FROM user_constraints c',
                    'WHERE c.constraint_type = \'C\'',
                    'AND NOT (c.generated = \'GENERATED NAME\' AND REGEXP_LIKE(c.search_condition_vc, \'^"[^"]+" IS NOT NULL$\'))',
                    'ORDER BY 1, 2, 6',
                ].join(' '),
                parameters: [],
            };
        }
        default: {
            return undefined;
        }
    }
}

function flag(value: ConstraintRow['system']): boolean {
    return value === true || Number(value) === 1;
}

function named<T extends object>(row: ConstraintRow, value: T): T & { name?: string } {
    return flag(row.system) ? value : { name: row.name, ...value };
}

function suffix(...parts: (string | null | undefined)[]): string {
    return parts.filter((part) => !!part).map((part) => ` ${part}`).join('');
}

/**
 * Fold constraint rows (ordered by table, name and key position) into the primary key,
 * uniques, checks and foreign keys per table. A generated name is left out, so an unnamed
 * constraint is matched by its columns or its expression. The definition spells what typeorm
 * does not report: the key order, a descending key part, a clustered (mssql) key, a deferrable,
 * disabled or not validated constraint.
 */
export function normalizeConstraintRows(rows: ConstraintRow[]): Map<string, NativeConstraints> {
    const result = new Map<string, NativeConstraints>();
    const grouped = new Map<string, ConstraintRow[]>();

    for (const row of rows) {
        const key = `${row.table}\0${row.name}`;

        grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }

    for (const parts of grouped.values()) {
        const [first] = parts;
        const constraints = result.get(first.table) ?? {
            primaryKey: null,
            uniques: [],
            checks: [],
            foreignKeys: [],
        };

        result.set(first.table, constraints);

        const columns = parts.map((part) => part.column as string);
        const keyParts = parts
            .map((part) => (flag(part.descending) ? `${part.column} DESC` : part.column))
            .join(', ');
        const deferrable = first.deferrable ?? null;

        switch (first.kind) {
            case 'p':
            case 'u': {
                const key = named(first, {
                    columns,
                    deferrable,
                    definition: `${first.kind === 'p' ? 'PRIMARY KEY' : 'UNIQUE'} (${keyParts})${
                        suffix(deferrable && `DEFERRABLE ${deferrable}`, first.options)}`,
                });

                if (first.kind === 'p') {
                    constraints.primaryKey = key;
                } else {
                    constraints.uniques.push(key as SchemaSnapshotUnique);
                }

                break;
            }
            case 'f': {
                const referencedColumns = parts.map((part) => part.referencedColumn as string);
                // typeorm and mssql spell NO_ACTION, SET_NULL with an underscore
                const onDelete = first.onDelete ? first.onDelete.replace('_', ' ') : null;
                const onUpdate = first.onUpdate ? first.onUpdate.replace('_', ' ') : 'NO ACTION';

                constraints.foreignKeys.push(named(first, {
                    columns,
                    referencedTable: first.referencedTable as string,
                    referencedColumns,
                    onDelete,
                    onUpdate,
                    deferrable,
                    definition: `FOREIGN KEY (${columns.join(', ')}) REFERENCES ${first.referencedTable} (${referencedColumns.join(', ')})${
                        suffix(onDelete && `ON DELETE ${onDelete}`, `ON UPDATE ${onUpdate}`, deferrable && `DEFERRABLE ${deferrable}`, first.options)}`,
                }) as SchemaSnapshotForeignKey);

                break;
            }
            default: {
                const expression = first.expression ?? '';

                constraints.checks.push(named(first, {
                    expression,
                    definition: `CHECK (${expression})${suffix(deferrable && `DEFERRABLE ${deferrable}`, first.options)}`,
                }) as SchemaSnapshotCheck);
            }
        }
    }

    return result;
}

/**
 * Read every key, foreign key and check constraint of the given tables, or undefined when the
 * driver has no constraint reader (typeorm's constraints stay then).
 */
export async function readNativeConstraints(
    queryRunner: QueryRunner,
    tables: string[],
): Promise<Map<string, NativeConstraints> | undefined> {
    const { options } = queryRunner.connection;
    const statement = buildConstraintStatement(options.type, (options as { schema?: string }).schema);

    if (!statement) {
        return undefined;
    }

    const rows = await queryRunner.query(statement.sql, statement.parameters) as ConstraintRow[];
    const wanted = new Set(tables);

    return normalizeConstraintRows(rows.filter((row) => wanted.has(row.table)));
}
