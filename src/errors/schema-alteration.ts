import { TypeormExtensionError } from './base';

/**
 * The database is in neither the state the alteration expects nor the one it
 * would produce, so there is nothing it can safely do.
 *
 * Raised instead of returning quietly, because a repair migration which does
 * not repair anything is indistinguishable from a successful one — the guard
 * exists to make a run resumable, not to swallow a wrong description of the
 * database.
 */
export class SchemaAlterationError extends TypeormExtensionError {
    static tableNotFound(table: string) {
        return new SchemaAlterationError(
            `The table ${table} does not exist.`,
        );
    }

    static columnNotFound(table: string, column: string) {
        return new SchemaAlterationError(
            `The column ${column} does not exist in the table ${table}.`,
        );
    }

    static columnMismatch(table: string, column: string) {
        return new SchemaAlterationError(
            `The column ${column} of the table ${table} matches neither the current ` +
            'nor the desired type description.',
        );
    }

    static indexNotFound(table: string, name: string) {
        return new SchemaAlterationError(
            `Neither an index named ${name} nor the renamed one exists on the table ${table}.`,
        );
    }

    static foreignKeyNotFound(table: string, name: string) {
        return new SchemaAlterationError(
            `Neither a foreign key named ${name} nor the renamed one exists on the table ${table}. ` +
            'Pass `meta` to restore a constraint an interrupted run left behind.',
        );
    }
}
