import type { QueryRunner } from 'typeorm';
import { useSource } from './catalogue';
import type { SchemaSnapshotTable } from '../types';

/**
 * The schema a cockroachdb, mssql or oracle session reads (`options.schema`, else the session's
 * own), or undefined for a driver whose definitions print no own-schema qualifier.
 *
 * Postgres prints none once `search-path.ts` pins the search path; cockroachdb still qualifies a
 * type (`'b'::app.status`), mssql a function (`[app].[f]`), oracle a function of the user
 * (`"APP"."F"`), so the same DDL in two schemas would read differently.
 */
export async function readOwnSchema(queryRunner: QueryRunner): Promise<string | undefined> {
    const { type, schema } = useSource(queryRunner);
    let sql: string;

    switch (type) {
        case 'cockroachdb':
            sql = 'SELECT current_schema() AS "schema"';

            break;
        case 'mssql':
            sql = 'SELECT SCHEMA_NAME() AS [schema]';

            break;
        case 'oracle':
            // the session's schema, whatever options.schema says: the readers use the user_ views
            sql = 'SELECT sys_context(\'USERENV\', \'CURRENT_SCHEMA\') AS "schema" FROM dual';

            break;
        default:
            return undefined;
    }

    if (schema && type !== 'oracle') {
        return schema;
    }

    const [row] = await queryRunner.query(sql) as { schema?: string | null }[];

    return row?.schema ?? undefined;
}

// RegExp.escape needs node 24, the package supports node 22: escape every non-word character
function escape(value: string): string {
    return [...value].map((char) => (/\w/.test(char) ? char : `\\${char}`)).join('');
}

/**
 * Remove the qualifier of the own schema (`app.`, `"app".`, `[app].`) from a definition,
 * outside string literals.
 */
export function stripOwnQualifier(text: string, schema: string): string {
    const name = escape(schema);
    const qualifier = new RegExp(`(?<![\\w$#@."\\]])(?:"${name}"|\\[${name}\\]|${name})\\.(?=["\\[\\w])`, 'g');

    return text
        .split(/('(?:[^']|'')*')/)
        .map((part, i) => (i % 2 === 0 ? part.replace(qualifier, '') : part))
        .join('');
}

/**
 * The table with the own schema qualifier removed from every expression and definition.
 */
export function unqualifyTable(table: SchemaSnapshotTable, schema: string): SchemaSnapshotTable {
    const strip = <T extends string | null>(value: T): T => (value === null ? value : stripOwnQualifier(value, schema) as T);

    return {
        ...table,
        columns: table.columns.map((column) => ({
            ...column,
            default: strip(column.default),
            asExpression: strip(column.asExpression),
            onUpdate: strip(column.onUpdate),
        })),
        primaryKey: table.primaryKey ? { ...table.primaryKey, definition: strip(table.primaryKey.definition) } : null,
        indices: table.indices.map((index) => ({
            ...index,
            where: strip(index.where),
            definition: strip(index.definition),
        })),
        uniques: table.uniques.map((unique) => ({ ...unique, definition: strip(unique.definition) })),
        checks: table.checks.map((check) => ({
            ...check,
            expression: strip(check.expression),
            definition: strip(check.definition),
        })),
        exclusions: table.exclusions.map((exclusion) => ({
            ...exclusion,
            expression: strip(exclusion.expression),
            definition: strip(exclusion.definition),
        })),
        foreignKeys: table.foreignKeys.map((foreignKey) => ({ ...foreignKey, definition: strip(foreignKey.definition) })),
    };
}
