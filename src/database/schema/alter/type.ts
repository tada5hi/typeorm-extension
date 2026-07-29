/**
 * Dialects for which a rename can be expressed.
 * mariadb is served by mysql, cockroachdb by postgres.
 */
export type SchemaDialect = 'postgres' | 'mysql';

export type SchemaRenameIndexInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    /**
     * Current index name.
     */
    from: string,
    /**
     * Desired index name.
     */
    to: string
};

export type SchemaRenameForeignKeyInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    /**
     * Current constraint name.
     */
    from: string,
    /**
     * Desired constraint name.
     */
    to: string,

    /**
     * Definition used to re-create the constraint when neither `from` nor `to`
     * exists — the state a run interrupted between the drop and the re-add
     * leaves behind on mysql, where the definition can no longer be read back.
     *
     * Ignored while `from` still exists: the normal path always describes the
     * constraint from the database, so a rename can not silently change it.
     *
     * Either all three of columns/referencedTable/referencedColumns are given,
     * or none of them.
     */
    columns?: string[],
    referencedTable?: string,
    referencedColumns?: string[],
    onDelete?: string,
    onUpdate?: string
};

export type SchemaAddForeignKeyInput = {
    table: string,
    name: string,
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    onDelete?: string,
    onUpdate?: string
};

export type SchemaColumnType = {
    type: string,
    length?: string | number,
    /**
     * Only compared/applied if defined.
     */
    nullable?: boolean
};

export type SchemaChangeColumnTypeInput = {
    /**
     * Table name, optionally schema qualified (e.g. `public.user`).
     */
    table: string,
    column: string,
    /**
     * The column type expected to be present. The helper is a no-op if the
     * column does not match it (e.g. because it is already migrated).
     */
    from: SchemaColumnType,
    to: SchemaColumnType
};
