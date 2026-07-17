import type { ConnectionParams } from '../type';

/**
 * Assemble the TNS connect descriptor when none is configured.
 */
export function buildOracleConnectString(params: ConnectionParams): string {
    let address = '(PROTOCOL=TCP)';

    if (params.host) {
        address += `(HOST=${params.host})`;
    }

    if (params.port) {
        address += `(PORT=${params.port})`;
    }

    let connectData = '(SERVER=DEDICATED)';

    if (params.sid) {
        connectData += `(SID=${params.sid})`;
    }

    if (params.serviceName) {
        connectData += `(SERVICE_NAME=${params.serviceName})`;
    }

    return `(DESCRIPTION=(ADDRESS=${address})(CONNECT_DATA=${connectData}))`;
}

/**
 * @link https://github.com/typeorm/typeorm/blob/master/src/driver/oracle/OracleQueryRunner.ts#L295
 *
 * NOTE: IF NOT EXISTS is not valid Oracle SQL. The statement is preserved
 * byte-for-byte from the previous implementation for fidelity — changing
 * it is a semantic decision, not a refactor side effect.
 */
export function buildOracleCreateDatabaseQuery(database: string): string {
    return `CREATE DATABASE IF NOT EXISTS ${database}`;
}
