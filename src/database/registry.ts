import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../errors';
import { hasOwnProperty } from '../utils';
import {
    MongoDBConnector,
    MsSQLConnector,
    MySQLConnector,
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
 * Adding a driver = one dialect folder in core/, one adapter, one row here.
 */
const registry: Record<DatabaseDialectName, DatabaseDialectRegistryEntry> = {
    postgres: {
        dialect: new PostgresDialect(),
        buildParams: buildConnectionParams,
        buildConnector: (options, params) => new PostgresConnector(options, params),
    },
    // cockroachdb speaks the pg wire protocol and reuses the postgres adapter
    cockroachdb: {
        dialect: new CockroachDBDialect(),
        buildParams: buildConnectionParams,
        buildConnector: (options, params) => new PostgresConnector(options, params),
    },
    mysql: {
        dialect: new MySQLDialect(),
        buildParams: buildConnectionParams,
        buildConnector: (options, params) => new MySQLConnector(options, params),
    },
    mssql: {
        dialect: new MsSQLDialect(),
        buildParams: buildConnectionParams,
        buildConnector: (options, params) => new MsSQLConnector(options, params),
    },
    oracle: {
        dialect: new OracleDialect(),
        buildParams: buildConnectionParams,
        buildConnector: (options, params) => new OracleConnector(options, params),
    },
    mongodb: {
        dialect: new MongoDBDialect(),
        buildParams: buildConnectionParams,
        buildMongoConnector: (options, params) => new MongoDBConnector(options, params),
    },
    'better-sqlite3': {
        dialect: new SQLiteDialect(),
        buildParams: buildConnectionParams,
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
