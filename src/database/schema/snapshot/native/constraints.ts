import type { DataSourceOptions, QueryRunner } from 'typeorm';
import { SchemaSnapshotError } from '../../../../errors/schema-snapshot';
import type { CatalogueStatement, ConstraintPart, NativeConstraints } from './types';
import {
    flag,
    groupByName,
    named,
    readCatalogue,
    readInformationSchemaColumns,
    useSource,
} from './catalogue';
import type {
    SchemaSnapshotCheck,
    SchemaSnapshotForeignKey,
    SchemaSnapshotTable,
    SchemaSnapshotUnique,
} from '../types';

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

/**
 * The parts of a table the constraint reader of the driver replaces: every constraint on mssql and
 * oracle, the checks on mysql and mariadb (typeorm reads none there), nothing elsewhere.
 */
export function readsConstraintParts(type: DataSourceOptions['type']): ConstraintPart[] {
    switch (type) {
        case 'mssql':
        case 'oracle':
            return ['primaryKey', 'uniques', 'checks', 'foreignKeys'];
        case 'mysql':
        case 'mariadb':
            return ['checks'];
        default:
            return [];
    }
}

/**
 * The statement listing the constraints of the current schema that `readsConstraintParts` names,
 * or undefined for a driver whose constraints typeorm reads reliably enough (the key readers of
 * keys.ts complete them there).
 *
 * Mysql and mariadb: the checks, with `NOT ENFORCED` (mysql). `checkColumns` names the columns of
 * `information_schema.check_constraints`: mysql before 8.0.16 has none (and no checks), mariadb
 * needs `TABLE_NAME` (10.2.22, 10.3.10).
 * Mssql: typeorm reports key columns in table column order and foreign key columns in no defined
 * order, and leaves out the direction of a key part and whether the key index is clustered.
 * Oracle: typeorm drops every constraint with a system generated name (an unnamed primary key,
 * unique or check), and sorts no key. Both name an unnamed constraint at random (`PK__t__3BD0198E`,
 * `SYS_C009090`), so `system` marks a generated name, which is left out of the snapshot.
 * Oracle's generated NOT NULL checks are left out when enabled and validated on a column that
 * reports itself NOT NULL: the column nullability reports them. A key carries its backing index
 * when that is named otherwise or not unique, and every oracle constraint its RELY.
 */
export function buildConstraintStatement(
    type: DataSourceOptions['type'],
    schema?: string,
    checkColumns: Set<string> = new Set(['CHECK_CLAUSE', 'TABLE_NAME']),
): CatalogueStatement | undefined {
    switch (type) {
        case 'mysql':
        case 'mariadb': {
            if (!checkColumns.has('CHECK_CLAUSE')) {
                return undefined;
            }

            if (type === 'mariadb') {
                return checkColumns.has('TABLE_NAME') ?
                    {
                        sql: [
                            'SELECT table_name AS `table`, constraint_name AS `name`, \'c\' AS `kind`, check_clause AS `expression`',
                            'FROM information_schema.check_constraints WHERE constraint_schema = DATABASE()',
                            'ORDER BY table_name, constraint_name',
                        ].join(' '),
                        parameters: [],
                    } :
                    undefined;
            }

            return {
                sql: [
                    'SELECT tc.table_name AS `table`, tc.constraint_name AS `name`, \'c\' AS `kind`, cc.check_clause AS `expression`,',
                    'CASE WHEN tc.enforced = \'NO\' THEN \'NOT ENFORCED\' END AS `options`',
                    'FROM information_schema.table_constraints tc',
                    'JOIN information_schema.check_constraints cc',
                    'ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name',
                    'WHERE tc.table_schema = DATABASE() AND tc.constraint_type = \'CHECK\'',
                    'ORDER BY tc.table_name, tc.constraint_name',
                ].join(' '),
                parameters: [],
            };
        }
        case 'mssql': {
            const scope = `t.schema_id = SCHEMA_ID(${schema ? '@0' : ''})`;

            return {
                sql: [
                    'SELECT t.name AS [table], kc.name AS [name], LOWER(LEFT(kc.type, 1)) AS [kind], CAST(kc.is_system_named AS int) AS [system],',
                    'c.name AS [column], CAST(ic.is_descending_key AS int) AS [descending], ic.key_ordinal AS [position],',
                    'NULL AS [referencedTable], NULL AS [referencedColumn], NULL AS [onDelete], NULL AS [onUpdate], NULL AS [expression],',
                    'i.type_desc + CASE WHEN i.ignore_dup_key = 1 THEN \' IGNORE_DUP_KEY\' ELSE \'\' END AS [options]',
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
            const state = 'CASE WHEN c.status = \'DISABLED\' THEN \' DISABLE\' END || ' +
                'CASE WHEN c.validated = \'NOT VALIDATED\' THEN \' NOVALIDATE\' END || CASE WHEN c.rely = \'RELY\' THEN \' RELY\' END';
            const deferrable = 'CASE WHEN c.deferrable = \'DEFERRABLE\' THEN \'INITIALLY \' || c.deferred END AS "deferrable",';
            const flags = `${deferrable} TRIM(${state}) AS "options"`;
            const index = 'CASE WHEN c.index_name <> c.constraint_name THEN \' USING INDEX \' || c.index_name END || ' +
                'CASE WHEN i.uniqueness = \'NONUNIQUE\' THEN \' NONUNIQUE\' END';
            const system = 'CASE WHEN c.generated = \'GENERATED NAME\' THEN 1 ELSE 0 END AS "system"';

            return {
                sql: [
                    `SELECT c.table_name AS "table", c.constraint_name AS "name", LOWER(c.constraint_type) AS "kind", ${system},`,
                    'cc.column_name AS "column", cc.position AS "position", NULL AS "referencedTable", NULL AS "referencedColumn",',
                    `NULL AS "onDelete", NULL AS "expression", ${deferrable} TRIM(${index} || ${state}) AS "options"`,
                    'FROM user_constraints c',
                    'JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name',
                    'LEFT JOIN user_indexes i ON i.index_name = c.index_name',
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
                    'AND NOT (c.generated = \'GENERATED NAME\' AND c.status = \'ENABLED\' AND c.validated = \'VALIDATED\'',
                    'AND EXISTS (SELECT 1 FROM user_tab_cols tc WHERE tc.table_name = c.table_name AND tc.nullable = \'N\'',
                    'AND c.search_condition_vc = \'"\' || tc.column_name || \'" IS NOT NULL\'))',
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

/**
 * The name of a constraint, none for a name the server generated.
 */
function nameOf(row: ConstraintRow): string | undefined {
    return flag(row.system) ? undefined : row.name;
}

function suffix(...parts: (string | null | undefined)[]): string {
    return parts.filter((part) => !!part).map((part) => ` ${part}`).join('');
}

/**
 * Fold constraint rows (ordered by table, name and key position) into the primary key,
 * uniques, checks and foreign keys per table. A generated name is left out, so an unnamed
 * constraint is matched by its columns or its expression. The definition spells what typeorm
 * does not report: the key order, a descending key part, a clustered (mssql) key, a deferrable,
 * disabled, not validated, not enforced or RELY constraint, the backing index of an oracle key.
 */
export function normalizeConstraintRows(rows: ConstraintRow[]): Map<string, NativeConstraints> {
    const result = new Map<string, NativeConstraints>();

    for (const parts of groupByName(rows)) {
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
                const key = named(nameOf(first), {
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

                constraints.foreignKeys.push(named(nameOf(first), {
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

                constraints.checks.push(named(nameOf(first), {
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
    const { type, schema } = useSource(queryRunner);
    const checkColumns = type === 'mysql' || type === 'mariadb' ?
        await readInformationSchemaColumns(queryRunner, 'CHECK_CONSTRAINTS') :
        undefined;

    // mariadb enforces checks since 10.2.1 but lists them with their table only since 10.2.22:
    // comparing none would be a false equal (mysql before 8.0.16 has no checks at all)
    if (type === 'mariadb' && !buildConstraintStatement(type, schema, checkColumns)) {
        throw SchemaSnapshotError.checksNotReadable(type);
    }

    return readCatalogue(queryRunner, tables, buildConstraintStatement(type, schema, checkColumns), normalizeConstraintRows);
}
