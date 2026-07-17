import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../errors';
import { hasOwnProperty } from '../utils';
import {
    MongoDBConnector,
    MsSQLConnector,
    MySQLConnector,
    NodeFileSystem,
    OracleConnector,
    PostgresConnector,
} from './adapters';
import type {
    DatabaseDialectName,
    DatabaseDialectRegistryEntry,
} from './core';
import {
    CockroachDBDialect,
    MongoDBDialect,
    MsSQLDialect,
    MySQLDialect,
    OracleDialect,
    PostgresDialect,
    SQLiteDialect,
    buildConnectionParams,
} from './core';

/**
 * The single dispatch site: a closed set of dialects known at build time.
 * Each entry composes a dialect with its connector (overridable for tests
 * and caller supplied connections).
 * Adding a driver = one dialect folder in core/, one adapter, one row here.
 */
const registry: Record<DatabaseDialectName, DatabaseDialectRegistryEntry> = {
    postgres: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new PostgresDialect(
            overrides.connector || new PostgresConnector(options, params),
        ),
    },
    // cockroachdb speaks the pg wire protocol and reuses the postgres connector
    cockroachdb: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new CockroachDBDialect(
            overrides.connector || new PostgresConnector(options, params),
        ),
    },
    mysql: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new MySQLDialect(
            overrides.connector || new MySQLConnector(options, params),
        ),
    },
    mssql: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new MsSQLDialect(
            overrides.connector || new MsSQLConnector(options, params),
        ),
    },
    oracle: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new OracleDialect(
            overrides.connector || new OracleConnector(options, params),
        ),
    },
    mongodb: {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new MongoDBDialect(
            overrides.connector || new MongoDBConnector(options, params),
        ),
    },
    'better-sqlite3': {
        buildParams: buildConnectionParams,
        buildDialect: (options, params, overrides) => new SQLiteDialect(
            overrides.fs || new NodeFileSystem(),
            overrides.cwd || process.cwd(),
        ),
    },
};

/**
 * @throws DriverError
 */
export function resolveDatabaseDialectName(type: DataSourceOptions['type']): DatabaseDialectName {
    if (type === 'mariadb') {
        return 'mysql';
    }

    if (hasOwnProperty(registry, type)) {
        return type as DatabaseDialectName;
    }

    throw DriverError.notSupported(type);
}

export function useDatabaseDialectEntry(name: DatabaseDialectName): DatabaseDialectRegistryEntry {
    return registry[name];
}
