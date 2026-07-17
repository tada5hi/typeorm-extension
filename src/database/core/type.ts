import type { DataSourceOptions } from 'typeorm';

/**
 * A session against a database server (never a TypeORM DataSource).
 *
 * Lifecycle: open() performs the handshake once — concurrent and repeated
 * calls share the same attempt — and is optional, since execute() opens
 * the session on demand. close() is terminal: a closed session cannot be
 * reopened, and closing a never-opened session is a no-op.
 */
export interface IDatabaseSession {
    open(): Promise<void>;

    execute(sql: string): Promise<unknown>;

    close(): Promise<void>;
}

/**
 * Connector for SQL speaking database servers.
 *
 * session() is a cheap factory — no I/O happens before open().
 * The optional database argument overrides the session's target database
 * (e.g. the initial database, or a freshly created database). When omitted,
 * the server side default (maintenance database) is used.
 */
export interface IDatabaseConnector {
    session(database?: string): IDatabaseSession;
}

/**
 * MongoDB speaks commands, not SQL, and therefore owns a separate connector.
 */
export interface IMongoDatabaseSession {
    open(): Promise<void>;

    dropDatabase(): Promise<unknown>;

    close(): Promise<void>;
}

export interface IMongoDatabaseConnector {
    session(database?: string): IMongoDatabaseSession;
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
 * receives its connector(s) via the constructor.
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
    connector?: IDatabaseConnector,
    mongo?: IMongoDatabaseConnector,
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
