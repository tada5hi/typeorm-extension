import process from 'node:process';
import type { DataSourceOptions } from 'typeorm';
import { suite } from 'vitest';

/**
 * Drivers the integration suite can be pointed at.
 * better-sqlite3 needs no server and is covered by the default suite.
 */
export const INTEGRATION_DRIVERS = [
    'postgres',
    'cockroachdb',
    'mysql',
    'mariadb',
    'mssql',
    'oracle',
    'mongodb',
] as const;

export type IntegrationDriver = typeof INTEGRATION_DRIVERS[number];

const DEFAULT_PORT : Record<IntegrationDriver, number> = {
    postgres: 5432,
    cockroachdb: 26257,
    mysql: 3306,
    mariadb: 3306,
    mssql: 1433,
    oracle: 1521,
    mongodb: 27017,
};

/**
 * The driver the integration suite runs against, configured through the same
 * env variables the library itself reads. Undefined if none is configured,
 * in which case the integration suites skip themselves.
 */
export function useIntegrationDriver() : IntegrationDriver | undefined {
    const value = process.env.TYPEORM_CONNECTION || process.env.DB_TYPE;

    if (
        value &&
        (INTEGRATION_DRIVERS as readonly string[]).includes(value)
    ) {
        return value as IntegrationDriver;
    }

    return undefined;
}

/**
 * Whether the guarded rename helpers can express a rename for the driver.
 */
export function supportsSchemaAlter(driver?: IntegrationDriver) : boolean {
    return !!driver && ['postgres', 'cockroachdb', 'mysql', 'mariadb'].includes(driver);
}

/**
 * Whether the driver has a session level foreign key check switch.
 */
export function supportsForeignKeyChecks(driver?: IntegrationDriver) : boolean {
    return driver === 'mysql' || driver === 'mariadb';
}

/**
 * Whether a column a foreign key depends on can be altered at all.
 *
 * mariadb refuses either end of a constraint outright (error 1832/1833),
 * no matter the foreign key checks or the chosen algorithm — the constraint
 * has to be dropped and re-added around the change there.
 */
export function supportsForeignKeyColumnAlter(driver?: IntegrationDriver) : boolean {
    return driver === 'mysql';
}

/**
 * Whether a conversion expression (`using`) can be expressed, which is what a
 * type change without an assignment cast between the two types needs.
 */
export function supportsConversionExpression(driver?: IntegrationDriver) : boolean {
    return driver === 'postgres' || driver === 'cockroachdb';
}

/**
 * Whether the driver has a relational schema to compare against
 * the entity metadata at all.
 */
export function supportsSchemaMetadata(driver?: IntegrationDriver) : boolean {
    return !!driver && driver !== 'mongodb';
}

/**
 * Dropping a database is not supported for oracle.
 */
export function supportsDatabaseDrop(driver?: IntegrationDriver) : boolean {
    return !!driver && driver !== 'oracle';
}

/**
 * Whether checkDatabase can report a missing database as `exists: false`.
 *
 * It derives that from a failing `DataSource.initialize()`, and cockroachdb
 * accepts the connection for a database which does not exist — the error only
 * surfaces on the first query, which checkDatabase lets propagate.
 */
export function supportsDatabaseExistenceCheck(driver?: IntegrationDriver) : boolean {
    return supportsSchemaMetadata(driver) && driver !== 'cockroachdb';
}

/**
 * An empty variable is a value, not an absence — the drivers which run without
 * authentication are configured with an explicitly empty user/password.
 */
function readEnv(...keys: string[]) : string | undefined {
    for (const key of keys) {
        if (typeof process.env[key] === 'string') {
            return process.env[key];
        }
    }

    return undefined;
}

export function createIntegrationDataSourceOptions(
    entities: any[] = [],
    override: Record<string, any> = {},
) : DataSourceOptions {
    const type = useIntegrationDriver();
    if (!type) {
        throw new Error('No integration driver is configured (TYPEORM_CONNECTION).');
    }

    const port = readEnv('TYPEORM_PORT', 'DB_PORT');

    const options : Record<string, any> = {
        type,
        host: readEnv('TYPEORM_HOST', 'DB_HOST') ?? '127.0.0.1',
        port: port ? Number.parseInt(port, 10) : DEFAULT_PORT[type],
        username: readEnv('TYPEORM_USERNAME', 'DB_USER') ?? 'root',
        password: readEnv('TYPEORM_PASSWORD', 'DB_PASS') ?? '',
        database: readEnv('TYPEORM_DATABASE', 'DB_NAME') ?? 'test',
        entities,
        migrations: [],
        ...override,
    };

    if (type === 'mssql') {
        // the images ship a self-signed certificate
        options.options = {
            encrypt: false,
            trustServerCertificate: true,
            ...(options.options || {}),
        };
    }

    if (type === 'oracle') {
        options.serviceName = readEnv('TYPEORM_SERVICE_NAME') || options.database;
    }

    return options as DataSourceOptions;
}
