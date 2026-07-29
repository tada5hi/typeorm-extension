import type {
    SchemaAddForeignKeyInput,
    SchemaDialect,
    SchemaRenameForeignKeyInput,
    SchemaRenameIndexInput,
} from './type';

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
