import type { Table, TableColumn } from 'typeorm';
import { isObject } from '../../../utils';
import type { SchemaColumnType } from './type';

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

/**
 * Whether a column still matches a (partial) type description.
 * length & nullable are only compared if they are defined.
 */
export function matchesColumnType(
    column: TableColumn,
    input: SchemaColumnType,
    normalizeType: (type: string) => string,
) : boolean {
    if (
        normalizeType(input.type).toLowerCase() !==
        normalizeType(column.type).toLowerCase()
    ) {
        return false;
    }

    if (
        typeof input.length !== 'undefined' &&
        normalizeColumnLength(input.length) !== normalizeColumnLength(column.length)
    ) {
        return false;
    }

    return !(
        typeof input.nullable === 'boolean' &&
        input.nullable !== column.isNullable
    );
}
