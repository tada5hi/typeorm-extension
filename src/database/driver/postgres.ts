import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import type { CockroachDriver } from 'typeorm/driver/cockroachdb/CockroachDriver';
import type {
    DatabaseBaseContext,
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { executeDatabaseCreate, executeDatabaseDrop } from '../methods/execute';
import type { DriverOptions } from './types';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../utils';

/**
 * @deprecated Use createDatabase() / the connection ports instead. Removed in the next major.
 */
export async function createSimplePostgresConnection(
    driver: PostgresDriver | CockroachDriver,
    options: DriverOptions,
    operationContext: DatabaseBaseContext,
) {
    /**
     * pg library
     */
    const { Client } = driver.postgres;

    const data : Record<string, any> = {
        host: options.host,
        port: options.port,
        user: options.user,
        password: options.password,
        ssl: options.ssl,
        schema: options.schema,
        ...(options.extra ? options.extra : {}),
    };

    if (typeof operationContext.initialDatabase === 'string') {
        data.database = operationContext.initialDatabase;
    }

    const client = new Client(data);

    await client.connect();

    return client;
}

/**
 * @deprecated Use createDatabase() / the connection ports instead. Removed in the next major.
 */
export async function executeSimplePostgresQuery(connection: any, query: string, endConnection = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if (endConnection) {
                connection.end();
            }

            if (queryErr) {
                reject(queryErr);
                return;
            }

            resolve(queryResult);
        });
    }));
}

/**
 * @deprecated Use createDatabase() instead — dialect dispatch is automatic.
 */
export async function createPostgresDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('postgres', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropPostgresDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('postgres', context);
}
