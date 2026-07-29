/**
 * Dialects for which a rename can be expressed.
 * mariadb is served by mysql, cockroachdb by postgres.
 */
export type SchemaDialect = 'postgres' | 'mysql';

/**
 * Every guarded alteration takes it: raise a `SchemaAlterationError` when the
 * database is in neither the expected nor the desired state, rather than
 * returning `false` and leaving a repair migration to report success without
 * having repaired anything.
 *
 * Being already in the desired state is never an error — that is what keeps a
 * run resumable, and it returns `false` in both modes.
 *
 * @default true
 */
export type SchemaStrictInput = {
    strict?: boolean
};

export type SchemaRenameIndexInput = SchemaStrictInput & {
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

/**
 * What a foreign key constraint consists of, beyond its name.
 */
export type SchemaForeignKeyMeta = {
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    onDelete?: string,
    onUpdate?: string
};

export type SchemaRenameForeignKeyInput = SchemaStrictInput & {
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
     * Used to re-create the constraint when neither `from` nor `to` exists —
     * the state a run interrupted between the drop and the re-add leaves behind
     * on mysql, where it can no longer be read back from the database.
     *
     * Ignored while `from` still exists: the normal path always describes the
     * constraint from the database, so a rename can not silently change it.
     */
    meta?: SchemaForeignKeyMeta
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

/**
 * The column as the database reports it, for a dialect which replaces the
 * definition in full (mysql's `MODIFY COLUMN`) — everything it does not
 * restate is dropped by the server. Dialects which only name the new type
 * (postgres) read nothing but `type` and `nullable`.
 */
export type SchemaColumnDefinition = {
    name: string,
    /**
     * Full type incl. length/precision, e.g. `varchar(255)`.
     */
    type: string,
    /**
     * Rendered as `NOT NULL` / `NULL`. Left out when undefined — mariadb
     * rejects the clause on a generated column.
     */
    nullable?: boolean,
    /**
     * Values of an `enum` / `set` column.
     */
    enum?: string[],
    unsigned?: boolean,
    charset?: string,
    collation?: string,
    /**
     * Expression of a generated column, and whether it is `VIRTUAL`/`STORED`.
     */
    asExpression?: string,
    generatedType?: string,
    /**
     * Raw SQL, as the database reports it.
     */
    default?: unknown,
    onUpdate?: string,
    autoIncrement?: boolean,
    comment?: string
};

export type SchemaColumnType = {
    type: string,
    length?: string | number,
    /**
     * Only compared/applied if defined.
     */
    nullable?: boolean
};

export type SchemaChangeColumnTypeInput = SchemaStrictInput & {
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
