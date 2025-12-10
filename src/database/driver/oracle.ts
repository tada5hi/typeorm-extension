import type { OracleDriver } from 'typeorm/driver/oracle/OracleDriver';
import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import type { DriverOptions } from './types';
import { buildDriverOptions, createDriver } from './utils';
import { buildDatabaseCreateContext, synchronizeDatabaseSchema } from '../utils';

export function createSimpleOracleConnection(
    driver: OracleDriver,
    options: DriverOptions,
) {
    const { getConnection } = driver.oracle;

    if (!options.connectString) {
        let address = '(PROTOCOL=TCP)';

        if (options.host) {
            address += `(HOST=${options.host})`;
        }

        if (options.port) {
            address += `(PORT=${options.port})`;
        }

        let connectData = '(SERVER=DEDICATED)';

        if (options.sid) {
            connectData += `(SID=${options.sid})`;
        }

        if (options.serviceName) {
            connectData += `(SERVICE_NAME=${options.serviceName})`;
        }

        options.connectString = `(DESCRIPTION=(ADDRESS=${address})(CONNECT_DATA=${connectData}))`;
    }

    return getConnection({
        user: options.user,
        password: options.password,
        connectString: options.connectString || options.url,
        ...(options.extra ? options.extra : {}),
    });
}

export async function createOracleDatabase(
    input: DatabaseCreateContextInput,
) {
    const context = await buildDatabaseCreateContext(input);
    const options = buildDriverOptions(context.options);
    const driver = createDriver(context.options) as OracleDriver;

    const connection = createSimpleOracleConnection(driver, options);
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */
    const query = `CREATE DATABASE IF NOT EXISTS ${options.database}`;

    const result = await connection.execute(query);

    if (context.synchronize) {
        await synchronizeDatabaseSchema(context.options);
    }

    return result;
}

export async function dropOracleDatabase(
    _context: DatabaseDropContextInput,
) {
    /**
     * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
     */

    return Promise.resolve();
}
