import type { SchemaSnapshotTable } from '../types';

/**
 * A catalogue statement with its bound parameters.
 */
export type CatalogueStatement = {
    sql: string,
    parameters: unknown[],
};

export type NativeColumn = {
    /**
     * The expression of a generated column, as the server prints it.
     */
    expression: string | null,
    generatedType: string | null,
    /**
     * `ALWAYS`, `BY DEFAULT` or `BY DEFAULT ON NULL` (oracle); undefined where the driver
     * reader does not read it (mysql, mariadb, mssql, better-sqlite3).
     */
    identity?: string | null,
    /**
     * Oracle `DEFAULT ON NULL` of a column without identity.
     */
    defaultOnNull: boolean,
    /**
     * Column options typeorm does not model: `INVISIBLE` (mysql, mariadb, oracle),
     * `NOT VISIBLE` (cockroachdb), `SPARSE` or `COLUMN_SET` (mssql).
     */
    options: string | null,
    /**
     * The cockroachdb `ON UPDATE` expression; undefined elsewhere.
     */
    onUpdate?: string | null,
    /**
     * A column the server adds on its own (cockroachdb implicit key, hash shard column) or an
     * unused oracle column: not part of the schema, typeorm may or may not read it.
     */
    system?: boolean,
};

export type NativeComments = {
    comment: string | null,
    columns: Map<string, string>,
};

export type NativeKey = {
    name: string,
    columns: string[],
    deferrable: string | null,
};

export type NativeKeys = {
    primary?: NativeKey,
    uniques: Map<string, NativeKey>,
    /**
     * The catalogue definition of each constraint by name (postgres, cockroachdb).
     */
    definitions: Map<string, string>,
};

export type ConstraintPart = 'primaryKey' | 'uniques' | 'checks' | 'foreignKeys';

export type NativeConstraints = Pick<SchemaSnapshotTable, ConstraintPart>;
