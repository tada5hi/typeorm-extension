import type { DataSourceOptions } from 'typeorm';
import { OptionsError } from '../../../errors';
import { applyMysqlTimezone } from './mysql';
import { applyOracleTimezone } from './oracle';
import { applyPostgresTimezone } from './postgres';
import type { DataSourceTimezone } from './type';
import { isDataSourceTimezone } from './utils';

/**
 * Pin a data source to a timezone (only UTC) on EVERY side of a zone-less
 * date column: the database session that stamps it (`now()`,
 * `CURRENT_TIMESTAMP`), and the driver that reads it and serializes Date
 * parameters into it. Left alone, the database stamps in its own session
 * zone while the driver reads and writes in the zone of the Node process,
 * which agree only while both clocks do.
 *
 * Each driver lives in its own file (`postgres.ts`, `mysql.ts`, `oracle.ts`);
 * every other driver needs nothing and is returned unchanged. It is all or
 * nothing per driver: a setting the caller already made on either side
 * returns the options unchanged, since half a pin shifts values rather than
 * fixing them, and that is also what makes the call idempotent. A given
 * `driver` is wrapped instead of the one typeorm would load.
 *
 * Only values written from then on are affected: rows a database stamped in
 * another zone before keep that wall clock.
 */
export function withDataSourceTimezone<T extends DataSourceOptions>(
    options: T,
    timezone: DataSourceTimezone,
) : T {
    if (!isDataSourceTimezone(timezone)) {
        throw OptionsError.timezoneUnsupported(timezone);
    }

    switch (options.type) {
        case 'mysql':
        case 'mariadb':
            return applyMysqlTimezone(options) as T;
        case 'postgres':
            return applyPostgresTimezone(options) as T;
        case 'oracle':
            return applyOracleTimezone(options) as T;
        default:
            return options;
    }
}
