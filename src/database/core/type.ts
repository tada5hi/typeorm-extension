import type { DataSourceOptions } from 'typeorm';

/**
 * A connection against a database server (never a TypeORM DataSource).
 *
 * execute() takes a statement in the server's native language:
 * SQL text for SQL speaking servers, a JSON encoded command document
 * for mongodb (executed via db.command()).
 *
 * Lifecycle: open() performs the handshake once — concurrent and repeated
 * calls share the same attempt — and is optional, since execute() opens
 * the connection on demand. close() is terminal: a closed connection cannot
 * be reopened, and closing a never-opened connection is a no-op.
 */
export interface IDatabaseConnection {
    open(): Promise<void>;

    execute(statement: string): Promise<unknown>;

    close(): Promise<void>;
}

/**
 * Factory for database server connections.
 *
 * create() is cheap — no I/O happens before open().
 * The optional database argument overrides the connection's target database
 * (e.g. the initial database, or a freshly created database). When omitted,
 * the server side default (maintenance database) is used.
 */
export interface IDatabaseConnectionFactory {
    create(database?: string): IDatabaseConnection;
}

/**
 * Filesystem effects for file backed databases (better-sqlite3).
 */
export interface IFileSystem {
    assertDirectoryWritable(path: string): Promise<void>;

    isFileWritable(path: string): Promise<boolean>;

    removeFile(path: string): Promise<void>;
}

/**
 * Dialect neutral connection facts, derived once per operation
 * from the resolved DataSourceOptions.
 */
export type ConnectionParams = {
    database?: string,
    host?: string,
    user?: string,
    password?: string,
    port?: number,
    ssl?: unknown,

    // required for oracle and optional for other drivers
    url?: string,
    connectString?: string,
    sid?: string | number,
    serviceName?: string,

    // mssql
    domain?: string,

    charset?: string,
    characterSet?: string,

    // postgres specific
    schema?: string,

    // only for postgres 13+, see https://www.postgresql.org/docs/current/manage-ag-templatedbs.html
    template?: string,

    extra?: Record<string, any>
};

export type DatabaseCreateOperation = {
    params: ConnectionParams,
    ifNotExist: boolean,
    initialDatabase?: string,
};

export type DatabaseDropOperation = {
    params: ConnectionParams,
    ifExist: boolean,
    initialDatabase?: string,
};

/**
 * A dialect owns the create/drop orchestration for one driver type and
 * receives its connection factory (or filesystem) via the constructor.
 *
 * Implementations must stay pure: types, typed errors and pure helpers only —
 * no native clients, no I/O, no environment state.
 */
export interface IDatabaseDialect {
    create(operation: DatabaseCreateOperation): Promise<unknown>;

    drop(operation: DatabaseDropOperation): Promise<unknown>;
}

export type DatabaseDialectName = 'postgres' | 'cockroachdb' | 'mysql' | 'mssql' |
'oracle' | 'mongodb' | 'better-sqlite3';

/**
 * Composition overrides for building a dialect —
 * used by tests and the caller supplied connection escape hatch.
 * Only the slot a dialect actually consumes has an effect.
 */
export type DatabaseDialectOverrides = {
    connectionFactory?: IDatabaseConnectionFactory,
    fs?: IFileSystem,
    cwd?: string,
};

export type DatabaseDialectRegistryEntry = {
    buildParams: (options: DataSourceOptions) => ConnectionParams,
    buildDialect: (
        options: DataSourceOptions,
        params: ConnectionParams,
        overrides: DatabaseDialectOverrides,
    ) => IDatabaseDialect,
};
