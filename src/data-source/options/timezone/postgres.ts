import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import type { PostgresTypes, TypeParser } from './type';
import { isDate } from './utils';

/**
 * `timestamp without time zone`.
 */
const POSTGRES_TIMESTAMP_OID = 1114;

/**
 * `timestamp with time zone`, whose parser honours an explicit zone marker
 * and handles `infinity` and BC dates.
 */
const POSTGRES_TIMESTAMP_TZ_OID = 1184;

/**
 * A `TimeZone` assignment among the postgres startup options, in either
 * spelling the server accepts (`-c TimeZone=...`, `--TimeZone=...`). The
 * name is matched whole: `log_timezone` sets something else entirely.
 */
const POSTGRES_TIMEZONE_OPTION = /(?:^|\s)(?:-c\s*|--)timezone=/i;

/**
 * Serialize a Date as pg does with `parseInputDatesAsUTC`, which is only
 * available process-wide there: UTC fields, an explicit `+00:00`, and a
 * ` BC` suffix for years before 1.
 */
export function serializePostgresDateAsUTC(date: Date) : string {
    let year = date.getUTCFullYear();
    const isBCYear = year < 1;
    if (isBCYear) {
        year = Math.abs(year) + 1;
    }

    const pad = (value: number, length = 2) => String(value).padStart(length, '0');

    let output = `${pad(year, 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
        `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}` +
        `.${pad(date.getUTCMilliseconds(), 3)}+00:00`;

    if (isBCYear) {
        output += ' BC';
    }

    return output;
}

function toPostgresUTCParameter(value: unknown) : unknown {
    if (isDate(value)) {
        return serializePostgresDateAsUTC(value);
    }

    if (Array.isArray(value)) {
        return value.map((element) => toPostgresUTCParameter(element));
    }

    return value;
}

/**
 * Build a postgres type parser that reads `timestamp without time zone` as
 * UTC and delegates every other type to the given `pg` types registry.
 */
export function createPostgresUTCTypes(types: PostgresTypes) : PostgresTypes {
    const parseZoned = types.getTypeParser(POSTGRES_TIMESTAMP_TZ_OID);

    // The text form is `YYYY-MM-DD HH:MM:SS[.ffffff][ BC]`: the marker goes
    // right after the time part, and `infinity` (no space) passes unchanged.
    const parseTimestamp : TypeParser = (value) => parseZoned(value.replace(/^(\S+ \S+)/, '$1Z'));

    return {
        getTypeParser(oid, format) {
            if (oid === POSTGRES_TIMESTAMP_OID && format !== 'binary') {
                return parseTimestamp;
            }

            return types.getTypeParser(oid, format);
        },
    };
}

/**
 * Derive a pg `Client` class which sends Date parameters as UTC. Left to pg,
 * a Date is sent with the offset of the Node process, which postgres drops
 * for a `timestamp without time zone`, storing the process's wall clock.
 * pg-pool takes the class through its `Client` option, so this stays scoped
 * to one pool.
 */
export function createPostgresUTCClient<T extends new (...args: any[]) => any>(Base: T) : T {
    return class extends Base {
        query(config: any, values?: any, callback?: any) {
            if (Array.isArray(values)) {
                return super.query(config, values.map((value) => toPostgresUTCParameter(value)), callback);
            }

            if (config && typeof config === 'object' && Array.isArray(config.values)) {
                config.values = config.values.map((value: unknown) => toPostgresUTCParameter(value));
            }

            return super.query(config, values, callback);
        }
    };
}

function isPostgresNativeInUse(nativeDriver: unknown, driver: Record<string, any>) : boolean {
    // mirrors typeorm, which switches to pg-native whenever it can load it
    if (!driver.native) {
        return false;
    }

    if (typeof nativeDriver !== 'undefined') {
        return !!nativeDriver;
    }

    try {
        return !!PlatformTools.load('pg-native');
    } catch {
        return false;
    }
}

/**
 * Pin a postgres data source: `-c TimeZone=UTC` as a startup option, a pool
 * type parser reading `timestamp without time zone` as UTC, and a pool client
 * sending Date parameters as UTC. A `TimeZone` startup option, `extra.types`
 * or `extra.Client` already set returns the options unchanged.
 */
export function applyPostgresTimezone(options: PostgresDataSourceOptions) : PostgresDataSourceOptions {
    const extra : Record<string, any> = { ...(options.extra ?? {}) };
    const startup = typeof extra.options === 'string' ? extra.options : '';

    if (
        POSTGRES_TIMEZONE_OPTION.test(startup) ||
        typeof extra.types !== 'undefined' ||
        typeof extra.Client !== 'undefined'
    ) {
        return options;
    }

    const driver = options.driver ?? PlatformTools.load('pg');
    const Base = isPostgresNativeInUse(options.nativeDriver, driver) ?
        driver.native.Client :
        driver.Client;

    extra.options = `${startup} -c TimeZone=UTC`.trim();
    extra.types = createPostgresUTCTypes(driver.types);
    extra.Client = createPostgresUTCClient(Base);

    return { ...options, extra };
}
