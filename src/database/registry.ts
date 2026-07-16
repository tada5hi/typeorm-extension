import type { DataSourceOptions } from 'typeorm';
import { DriverError } from '../errors';
import { hasOwnProperty } from '../utils';
import {
    MongoDBServerPort,
    MsSQLServerPort,
    MySQLServerPort,
    OracleServerPort,
    PostgresServerPort,
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
        buildServerPort: (options, params) => new PostgresServerPort(options, params),
    },
    // cockroachdb speaks the pg wire protocol and reuses the postgres adapter
    cockroachdb: {
        dialect: new CockroachDBDialect(),
        buildParams: buildConnectionParams,
        buildServerPort: (options, params) => new PostgresServerPort(options, params),
    },
    mysql: {
        dialect: new MySQLDialect(),
        buildParams: buildConnectionParams,
        buildServerPort: (options, params) => new MySQLServerPort(options, params),
    },
    mssql: {
        dialect: new MsSQLDialect(),
        buildParams: buildConnectionParams,
        buildServerPort: (options, params) => new MsSQLServerPort(options, params),
    },
    oracle: {
        dialect: new OracleDialect(),
        buildParams: buildConnectionParams,
        buildServerPort: (options, params) => new OracleServerPort(options, params),
    },
    mongodb: {
        dialect: new MongoDBDialect(),
        buildParams: buildConnectionParams,
        buildMongoPort: (options, params) => new MongoDBServerPort(options, params),
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
