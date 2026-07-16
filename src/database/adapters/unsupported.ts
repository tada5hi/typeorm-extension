import { DriverError } from '../../errors';
import type {
    IDatabaseConnector,
    IMongoDatabaseConnector,
} from '../core';

/**
 * Wired for dialects that never open the respective connection kind
 * (e.g. better-sqlite3 never connects to a server, postgres never
 * opens a mongo session). Connecting is a programming error.
 */
export class UnsupportedConnector implements IDatabaseConnector, IMongoDatabaseConnector {
    constructor(protected type: string) {
        this.type = type;
    }

    connect(): Promise<never> {
        return Promise.reject(
            new DriverError(`The driver ${this.type} does not support this connection kind.`),
        );
    }
}
