/**
 * The timezones a data source can be pinned to. Only UTC can be expressed
 * on every side: a zone-less value can be read as UTC by appending a marker,
 * while any other zone needs the offset in force at that instant.
 */
export type DataSourceTimezone = 'UTC';

// The driver shapes below are the parts of pg, mysql2 and node-oracledb the
// wrappers touch. They are internal: the barrel does not re-export them.

export type TypeParser = (value: string) => unknown;

export type PostgresTypes = {
    getTypeParser: (oid: number, format?: 'text' | 'binary') => TypeParser,
};

export type MysqlConnection = {
    query: (sql: string, callback: (err: unknown) => void) => unknown,
    destroy: () => void,
};
export type MysqlPool = {
    on: (event: string, listener: (connection: MysqlConnection) => void) => unknown,
};
export type MysqlModule = {
    createPool: (...args: any[]) => MysqlPool,
    [key: string]: any,
};

export type MethodReplacer = (original: (...args: any[]) => any) => (...args: any[]) => any;
