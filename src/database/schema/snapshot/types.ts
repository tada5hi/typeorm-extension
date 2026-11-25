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
};

/**
 * @experimental The schema snapshot API may change in a minor release.
 */
export type SchemaSnapshotTable = {
    name: string,
    columns: SchemaSnapshotColumn[],
    primaryKey: { name?: string, columns: string[] } | null,
    indices: SchemaSnapshotIndex[],
    uniques: { name?: string, columns: string[] }[],
    checks: { name?: string, expression: string }[],
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
