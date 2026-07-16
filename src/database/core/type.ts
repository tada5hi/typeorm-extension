import type { DataSourceOptions } from 'typeorm';

/**
 * An open session against a database server (never a TypeORM DataSource).
 */
export interface IDatabaseConnection {
    execute(sql: string): Promise<unknown>;

    close(): Promise<void>;
}

/**
 * Connection port for SQL speaking database servers.
 *
 * The optional database argument overrides the session's target database
 * (e.g. the initial database, or a freshly created database). When omitted,
 * the server side default (maintenance database) is used.
 */
export interface IDatabaseServerPort {
    connect(database?: string): Promise<IDatabaseConnection>;
}

/**
 * MongoDB speaks commands, not SQL, and therefore owns a separate port.
 */
export interface IMongoDatabaseConnection {
    dropDatabase(): Promise<unknown>;

    close(): Promise<void>;
}

export interface IMongoDatabaseServerPort {
    connect(database?: string): Promise<IMongoDatabaseConnection>;
}

/**
 * Filesystem effects for file backed databases (better-sqlite3).
 */
export interface IFileSystemPort {
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
 * Everything a dialect may touch. Assembled by the composition root;
 * ports a dialect does not need are wired to rejecting stubs.
 */
export type DialectRuntime = {
    server: IDatabaseServerPort,
    mongo: IMongoDatabaseServerPort,
    fs: IFileSystemPort,
    cwd: string,
};

/**
 * A dialect owns the create/drop orchestration for one driver type.
 *
 * Implementations must stay pure: types and typed errors only —
 * no native clients, no node built-ins, no environment state.
 */
export interface IDatabaseDialect {
    create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown>;

    drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown>;
}

export type DatabaseDialectName = 'postgres' | 'cockroachdb' | 'mysql' | 'mssql' |
'oracle' | 'mongodb' | 'better-sqlite3';

export type DatabaseDialectRegistryEntry = {
    dialect: IDatabaseDialect,
    buildParams: (options: DataSourceOptions) => ConnectionParams,
    buildServerPort?: (options: DataSourceOptions, params: ConnectionParams) => IDatabaseServerPort,
    buildMongoPort?: (options: DataSourceOptions, params: ConnectionParams) => IMongoDatabaseServerPort,
};
