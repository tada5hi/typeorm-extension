import type { QueryRunner } from 'typeorm';

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotColumn = {
    name: string,
    type: string,
    length: string | null,
    precision: number | null,
    scale: number | null,
    isNullable: boolean,
    default: string | null,
    isGenerated: boolean,
    generationStrategy: string | null,
    generatedType: string | null,
    asExpression: string | null,
    charset: string | null,
    collation: string | null,
    isUnsigned: boolean,
    enum: string[] | null,
    /**
     * The enum type name, when typeorm reads one other than the name it would build (postgres).
     */
    enumName: string | null,
    isArray: boolean,
    generatedIdentity: string | null,
    comment: string | null,
    onUpdate: string | null,
    spatialFeatureType: string | null,
    srid: number | null,
    /**
     * Column options typeorm does not model, read from the catalogue: `INVISIBLE` (mysql,
     * mariadb, oracle), `SPARSE` or `COLUMN_SET` (mssql); null otherwise.
     */
    options: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotIndex = {
    name?: string,
    columns: string[],
    isUnique: boolean,
    where: string | null,
    kind: 'spatial' | 'fulltext' | null,
    definition: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotForeignKey = {
    name?: string,
    columns: string[],
    /**
     * Unqualified table name.
     */
    referencedTable: string,
    referencedColumns: string[],
    onDelete: string | null,
    onUpdate: string | null,
    /**
     * `INITIALLY DEFERRED` or `INITIALLY IMMEDIATE` for a deferrable key, null otherwise.
     */
    deferrable: string | null,
    /**
     * The catalogue definition (`pg_get_constraintdef`, postgres only), null elsewhere.
     */
    definition: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotUnique = {
    name?: string,
    /**
     * In key order where a native reader exists (postgres, mysql, mariadb), sorted elsewhere.
     */
    columns: string[],
    /**
     * `INITIALLY DEFERRED` or `INITIALLY IMMEDIATE` for a deferrable constraint, null otherwise
     * (read on postgres only).
     */
    deferrable: string | null,
    /**
     * The catalogue definition (`pg_get_constraintdef`, postgres only), null elsewhere.
     */
    definition: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotExclusion = {
    name?: string,
    expression: string,
    /**
     * The catalogue definition (`pg_get_constraintdef`, postgres only), null elsewhere.
     */
    definition: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotCheck = {
    name?: string,
    expression: string,
    /**
     * The catalogue definition (`pg_get_constraintdef`, postgres only), null elsewhere.
     */
    definition: string | null,
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotTable = {
    name: string,
    comment: string | null,
    /**
     * Table options typeorm does not model, read from the catalogue: mariadb `SYSTEM VERSIONED`,
     * mssql `SYSTEM_VERSIONED_TEMPORAL_TABLE` or `HISTORY_TABLE`; null otherwise.
     */
    options: string | null,
    columns: SchemaSnapshotColumn[],
    /**
     * The key columns are in key order where a native reader exists (postgres, mysql, mariadb),
     * sorted elsewhere. `deferrable` is read on postgres only.
     */
    primaryKey: {
        name?: string,
        columns: string[],
        deferrable: string | null,
        definition: string | null,
    } | null,
    indices: SchemaSnapshotIndex[],
    uniques: SchemaSnapshotUnique[],
    checks: SchemaSnapshotCheck[],
    exclusions: SchemaSnapshotExclusion[],
    foreignKeys: SchemaSnapshotForeignKey[],
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotView = {
    name: string,
    expression: string,
    materialized: boolean,
};

/**
 * A normalized, read-only description of a database schema. Tables and views are
 * sorted by name, every list inside is sorted too.
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshot = {
    tables: SchemaSnapshotTable[],
    views: SchemaSnapshotView[],
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotOptions = {
    /**
     * Query runner to read with. It is never released by the reader.
     */
    queryRunner?: QueryRunner,
    /**
     * Tables left out of the snapshot (the migrations and metadata tables always are).
     */
    ignoreTables?: string[],
};

/**
 * One difference between two schema snapshots. `missing` means the element
 * exists in the expected snapshot only, `extra` in the actual one only.
 *
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotDifference = {
    path: string,
    kind: 'missing' | 'extra' | 'changed',
    expected?: unknown,
    actual?: unknown,
};
