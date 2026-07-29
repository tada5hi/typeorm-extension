import { DriverError } from '../../../errors';
import type {
    SchemaAddForeignKeyInput,
    SchemaColumnDefinition,
    SchemaDialect,
    SchemaRenameForeignKeyInput,
    SchemaRenameIndexInput,
} from './type';

/**
 * Quote a value mysql expects as a string literal (a charset name,
 * an enum value, a comment). Single quotes rather than the double ones
 * typeorm uses, since those are identifiers under `ANSI_QUOTES`.
 */
function escapeSchemaString(value: string) : string {
    return `'${value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\'\'')
        // not allowed in a comment
        .replace(/\0/g, '')}'`;
}

/**
 * Whether the body of a quoted literal escapes its quotes, i.e. whether
 * wrapping it in quotes again yields the same value.
 */
function isEscapedStringBody(value: string) : boolean {
    let index = 0;

    while (index < value.length) {
        const char = value[index];

        if (char === '\\') {
            index += 2;
            continue;
        }

        if (char === '\'') {
            if (value[index + 1] !== '\'') {
                return false;
            }

            index += 2;
            continue;
        }

        index += 1;
    }

    return true;
}

/**
 * A default as the driver reports it, ready to be repeated in a definition.
 *
 * typeorm builds a mysql string default by wrapping the raw value in quotes
 * without escaping what is inside it, so a default holding a quote comes back
 * as a literal the server can not parse (`'it's'`). Repairing it is not a
 * guess: a malformed literal can only have come from that wrapping, while a
 * properly escaped one (mariadb reports those) is passed through untouched.
 */
function buildDefault(value: unknown) : string {
    if (
        typeof value !== 'string' ||
        value.length < 2 ||
        !value.startsWith('\'') ||
        !value.endsWith('\'')
    ) {
        return `${value}`;
    }

    const body = value.slice(1, -1);

    return isEscapedStringBody(body) ? value : escapeSchemaString(body);
}

export function escapeSchemaIdentifier(dialect: SchemaDialect, name: string) : string {
    if (dialect === 'mysql') {
        return `\`${name.replace(/`/g, '``')}\``;
    }

    return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Escape a (potentially schema/database qualified) path, e.g. public.user.
 */
export function escapeSchemaPath(dialect: SchemaDialect, path: string) : string {
    return path
        .split('.')
        .map((part) => escapeSchemaIdentifier(dialect, part))
        .join('.');
}

/**
 * Qualify a name with the schema/database prefix of a table path,
 * e.g. (public.user, IDX_foo) -> public.IDX_foo
 */
function buildSiblingPath(table: string, name: string) : string {
    const parts = table.split('.');
    parts[parts.length - 1] = name;

    return parts.join('.');
}

export function buildRenameIndexQuery(dialect: SchemaDialect, input: SchemaRenameIndexInput) : string {
    if (dialect === 'mysql') {
        return `ALTER TABLE ${escapeSchemaPath(dialect, input.table)} ` +
            `RENAME INDEX ${escapeSchemaIdentifier(dialect, input.from)} ` +
            `TO ${escapeSchemaIdentifier(dialect, input.to)}`;
    }

    // in postgres an index is an object of the schema its table lives in
    return `ALTER INDEX ${escapeSchemaPath(dialect, buildSiblingPath(input.table, input.from))} ` +
        `RENAME TO ${escapeSchemaIdentifier(dialect, input.to)}`;
}

export function buildDropIndexQuery(dialect: SchemaDialect, table: string, name: string) : string {
    if (dialect === 'mysql') {
        return `ALTER TABLE ${escapeSchemaPath(dialect, table)} ` +
            `DROP INDEX ${escapeSchemaIdentifier(dialect, name)}`;
    }

    return `DROP INDEX ${escapeSchemaPath(dialect, buildSiblingPath(table, name))}`;
}

/**
 * postgres only — mysql has no RENAME CONSTRAINT and needs the
 * drop & re-add dance instead.
 */
export function buildRenameForeignKeyQuery(input: SchemaRenameForeignKeyInput) : string {
    return `ALTER TABLE ${escapeSchemaPath('postgres', input.table)} ` +
        `RENAME CONSTRAINT ${escapeSchemaIdentifier('postgres', input.from)} ` +
        `TO ${escapeSchemaIdentifier('postgres', input.to)}`;
}

export function buildDropForeignKeyQuery(dialect: SchemaDialect, table: string, name: string) : string {
    const keyword = dialect === 'mysql' ? 'FOREIGN KEY' : 'CONSTRAINT';

    return `ALTER TABLE ${escapeSchemaPath(dialect, table)} ` +
        `DROP ${keyword} ${escapeSchemaIdentifier(dialect, name)}`;
}

export function buildAddForeignKeyQuery(dialect: SchemaDialect, input: SchemaAddForeignKeyInput) : string {
    const columns = input.columns
        .map((column) => escapeSchemaIdentifier(dialect, column))
        .join(', ');

    const referencedColumns = input.referencedColumns
        .map((column) => escapeSchemaIdentifier(dialect, column))
        .join(', ');

    let query = `ALTER TABLE ${escapeSchemaPath(dialect, input.table)} ` +
        `ADD CONSTRAINT ${escapeSchemaIdentifier(dialect, input.name)} ` +
        `FOREIGN KEY (${columns}) ` +
        `REFERENCES ${escapeSchemaPath(dialect, input.referencedTable)} (${referencedColumns})`;

    if (input.onDelete) {
        query += ` ON DELETE ${input.onDelete}`;
    }

    if (input.onUpdate) {
        query += ` ON UPDATE ${input.onUpdate}`;
    }

    return query;
}

/**
 * mysql's `MODIFY COLUMN` replaces the previous definition in full, so the
 * rendered one has to restate the whole column, not just what changed.
 */
function buildColumnDefinition(column: SchemaColumnDefinition) : string {
    let definition = `${escapeSchemaIdentifier('mysql', column.name)} ${column.type}`;

    if (column.enum) {
        definition += `(${column.enum.map(escapeSchemaString).join(', ')})`;
    }

    if (column.unsigned) {
        definition += ' UNSIGNED';
    }

    if (column.charset) {
        definition += ` CHARACTER SET ${escapeSchemaString(column.charset)}`;
    }

    if (column.collation) {
        definition += ` COLLATE ${escapeSchemaString(column.collation)}`;
    }

    if (column.asExpression) {
        definition += ` AS (${column.asExpression}) ${column.generatedType || 'VIRTUAL'}`;
    }

    if (typeof column.nullable === 'boolean') {
        definition += column.nullable ? ' NULL' : ' NOT NULL';
    }

    if (
        typeof column.default !== 'undefined' &&
        column.default !== null
    ) {
        definition += ` DEFAULT ${buildDefault(column.default)}`;
    }

    if (column.onUpdate) {
        definition += ` ON UPDATE ${column.onUpdate}`;
    }

    if (column.autoIncrement) {
        definition += ' AUTO_INCREMENT';
    }

    if (column.comment) {
        definition += ` COMMENT ${escapeSchemaString(column.comment)}`;
    }

    return definition;
}

/**
 * Alter a column in place, keeping the values it holds.
 *
 * typeorm builds no statement for this: its `changeColumn` drops and re-adds
 * the column "to avoid data conversion" as soon as the type or the length
 * differs — on every driver but sqlite, which recreates the whole table and
 * copies the values over.
 *
 * postgres names the new type and nothing else, so the rest of the definition
 * (default, comment, identity) stays as it is; mysql replaces the definition
 * in full and therefore restates it.
 */
export function buildChangeColumnTypeQueries(
    dialect: SchemaDialect,
    table: string,
    column: SchemaColumnDefinition,
) : string[] {
    const path = escapeSchemaPath(dialect, table);

    if (dialect === 'mysql') {
        if (column.generatedType && !column.asExpression) {
            // restating the definition without the `AS` would turn a generated
            // column into a regular one, and drop every value it computes.
            // typeorm reads the expression from its own metadata table, so it
            // is empty whenever there is no row describing this column.
            throw DriverError.columnGenerationExpressionUnknown(column.name);
        }

        return [`ALTER TABLE ${path} MODIFY COLUMN ${buildColumnDefinition(column)}`];
    }

    const name = escapeSchemaIdentifier(dialect, column.name);
    const queries = [`ALTER TABLE ${path} ALTER COLUMN ${name} TYPE ${column.type}`];

    if (typeof column.nullable === 'boolean') {
        queries.push(
            `ALTER TABLE ${path} ALTER COLUMN ${name} ` +
            `${column.nullable ? 'DROP' : 'SET'} NOT NULL`,
        );
    }

    return queries;
}
