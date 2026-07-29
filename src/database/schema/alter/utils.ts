import type { Table, TableColumn } from 'typeorm';
import { isObject } from '../../../utils';
import type { SchemaColumnType, SchemaStrictInput } from './type';

/**
 * Guarded alterations raise on an unexpected database state unless told
 * otherwise.
 */
export function isStrict(input: SchemaStrictInput) : boolean {
    return input.strict !== false;
}

export function findTableIndex(table: Table, name: string) {
    return table.indices.find((index) => index.name === name);
}

export function findTableForeignKey(table: Table, name: string) {
    return table.foreignKeys.find((foreignKey) => foreignKey.name === name);
}

/**
 * Read the value of `SELECT @@SESSION.foreign_key_checks`.
 * Anything unexpected is treated as enabled, since that is the safe state
 * to restore to.
 */
export function isForeignKeyChecksEnabled(rows: unknown) : boolean {
    if (!Array.isArray(rows) || rows.length === 0) {
        return true;
    }

    const [row] = rows;
    if (!isObject(row)) {
        return true;
    }

    const [value] = Object.values(row);

    return `${value}` !== '0';
}

export function normalizeColumnLength(length?: string | number | null) : string {
    if (
        typeof length === 'undefined' ||
        length === null ||
        length === ''
    ) {
        return '';
    }

    return `${length}`;
}

export type SchemaColumnDescriber = {
    /**
     * The driver's own spelling of a type, e.g. varchar -> character varying.
     */
    normalizeType: (type: string) => string,
    /**
     * The full type the server would report, e.g. varchar + 255 ->
     * varchar(255). Resolves the default length of a type, which the driver
     * leaves empty on the loaded column: mysql reports a `varchar(255)` as
     * length `''` for a table it has no entity metadata for, and comparing the
     * raw values would call that a mismatch.
     */
    describeType: (type: string, length?: string | number) => string,
};

/**
 * Whether a column still matches a (partial) type description.
 * length & nullable are only compared if they are defined.
 */
export function matchesColumnType(
    column: TableColumn,
    input: SchemaColumnType,
    describer: SchemaColumnDescriber,
) : boolean {
    const { normalizeType, describeType } = describer;

    if (
        normalizeType(input.type).toLowerCase() !==
        normalizeType(column.type).toLowerCase()
    ) {
        return false;
    }

    if (
        typeof input.length !== 'undefined' &&
        describeType(input.type, input.length).toLowerCase() !==
        describeType(column.type, column.length).toLowerCase()
    ) {
        return false;
    }

    return !(
        typeof input.nullable === 'boolean' &&
        input.nullable !== column.isNullable
    );
}
