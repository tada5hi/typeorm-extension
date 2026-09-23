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
 * every other driver needs nothing and is returned unchanged. A setting the
 * caller already made is kept when it agrees with the pin (a UTC `timezone`,
 * a UTC `TimeZone`) or can be built upon (a pg `Client`, pg `types` leaving
 * timestamps alone, an oracle `sessionCallback` function), and throws an
 * `OptionsError` when it contradicts it: half a pin shifts values instead of
 * fixing them. Applying it twice returns the pinned options unchanged.
 *
 * Only values written from then on are affected: rows a database stamped in
 * another zone before keep that wall clock.
 */
export function pinTimezone<T extends DataSourceOptions>(
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
