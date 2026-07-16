import type { SqlServerDriver } from 'typeorm/driver/sqlserver/SqlServerDriver';
import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { executeDatabaseCreate, executeDatabaseDrop } from '../methods/execute';
import type { DriverOptions } from './types';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../utils';

/**
 * @deprecated Use createDatabase() / the connection ports instead. Removed in the next major.
 */
export async function createSimpleMsSQLConnection(
    driver: SqlServerDriver,
    options: DriverOptions,
) {
    const option : Record<string, any> = {
        user: options.user,
        password: options.password,
        server: options.host,
        port: options.port || 1433,
        ...(options.extra ? options.extra : {}),
        ...(options.domain ? { domain: options.domain } : {}),
    };

    await driver.mssql.connect(option);

    return driver.mssql;
}

/**
 * @deprecated Use createDatabase() instead — dialect dispatch is automatic.
 */
export async function createMsSQLDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('mssql', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropMsSQLDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('mssql', context);
}
