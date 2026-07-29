/**
 * A single reconciling statement, in the shape typeorm's schema builder emits it.
 */
export type SchemaDriftStatement = {
    query: string,
    parameters?: unknown[]
};

/**
 * The difference between the database schema and the entity metadata.
 *
 * The up statements would reconcile the database schema with the entity metadata,
 * the down statements would revert that reconciliation.
 */
export type SchemaDrift = {
    /**
     * Whether the database schema deviates from the entity metadata.
     */
    exists: boolean,
    up: SchemaDriftStatement[],
    down: SchemaDriftStatement[]
};

export type SchemaDriftOptions = {
    /**
     * Report no drift if the data source has no migrations registered.
     *
     * Useful for a data source which is shared between a migration driven
     * environment (postgres, mysql, ...) and a synchronize driven one
     * (e.g. an in-memory sqlite test database wired with `migrations: []`).
     *
     * default: false
     */
    skipWithoutMigrations?: boolean
};
