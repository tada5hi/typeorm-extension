import type { MysqlDriver } from 'typeorm/driver/mysql/MysqlDriver';
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
export async function createSimpleMySQLConnection(
    driver: MysqlDriver,
    options: DriverOptions,
) {
    /**
     * mysql|mysql2 library
     */
    const { createConnection } = driver.mysql;

    const option : Record<string, any> = {
        host: options.host,
        user: options.user,
        password: options.password,
        port: options.port,
        ssl: options.ssl,
        ...(options.extra ? options.extra : {}),
    };

    return createConnection(option);
}

/**
 * @deprecated Use createDatabase() / the connection ports instead. Removed in the next major.
 */
export async function executeSimpleMysqlQuery(connection: any, query: string, endConnection = true) {
    return new Promise(((resolve, reject) => {
        connection.query(query, (queryErr: any, queryResult: any) => {
            if (endConnection) connection.end();

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
export async function createMySQLDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('mysql', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropMySQLDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('mysql', context);
}
