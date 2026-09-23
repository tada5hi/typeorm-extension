import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { OptionsError } from '../../../errors';
import type { PostgresTypes, TypeParser } from './type';
import { isDate, isInstalled, markInstalled } from './utils';

/**
 * `timestamp without time zone` and its array.
 */
const POSTGRES_TIMESTAMP_OID = 1114;
const POSTGRES_TIMESTAMP_ARRAY_OID = 1115;

/**
 * `timestamp with time zone` and its array, whose parsers honour an
 * explicit zone marker and handle `infinity` and BC dates.
 */
const POSTGRES_TIMESTAMP_TZ_OID = 1184;
const POSTGRES_TIMESTAMP_TZ_ARRAY_OID = 1185;

/**
 * A `TimeZone` assignment among the postgres startup options, in either
 * spelling the server accepts (`-c TimeZone=...`, `--TimeZone=...`). The
 * name is matched whole: `log_timezone` sets something else entirely.
 */
const POSTGRES_TIMEZONE_OPTION = /(?:^|\s)(?:-c\s*|--)timezone=(\S+)/i;

const POSTGRES_UTC_ZONE = /^(?:utc|etc\/utc|universal|etc\/universal|zulu|z|gmt|etc\/gmt|[+-]?0{1,2}(?::?00)?)$/i;

/**
 * A zone-less timestamp inside the text form of a timestamp array.
 */
const POSTGRES_ARRAY_TIMESTAMP = /(\d{4,}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)/g;

/**
 * The exact form pg's `prepareValue` gives a Date (the process offset
 * included), which pg-cursor applies in its constructor, before a stream
 * reaches the client.
 */
const POSTGRES_LOCAL_DATE = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})([+-])(\d{2}):(\d{2})( BC)?$/;

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

/**
 * Re-serialize a Date which pg already turned into its local form (the
 * process offset included) as UTC. Any other value is returned unchanged.
 */
export function reserializePostgresLocalDateAsUTC(value: unknown) : unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const match = POSTGRES_LOCAL_DATE.exec(value);
    if (!match) {
        return value;
    }

    const [, year, month, day, hour, minute, second, millisecond, sign, offsetHours, offsetMinutes, bc] = match;

    let fullYear = Number(year);
    if (bc) {
        fullYear = 1 - fullYear;
    }

    const date = new Date(0);
    date.setUTCFullYear(fullYear, Number(month) - 1, Number(day));
    date.setUTCHours(Number(hour), Number(minute), Number(second), Number(millisecond));

    const offset = (Number(offsetHours) * 60 + Number(offsetMinutes)) * (sign === '-' ? -1 : 1);
    date.setTime(date.getTime() - offset * 60_000);

    return serializePostgresDateAsUTC(date);
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

function toPostgresUTCPreparedParameter(value: unknown) : unknown {
    if (Array.isArray(value)) {
        return value.map((element) => toPostgresUTCPreparedParameter(element));
    }

    return reserializePostgresLocalDateAsUTC(value);
}

/**
 * Build postgres type parsers which read `timestamp without time zone` (and
 * its array) as UTC and delegate every other type to the given registry.
 */
export function createPostgresUTCTypes(types: PostgresTypes, fallback: PostgresTypes = types) : PostgresTypes {
    const parseZoned = fallback.getTypeParser(POSTGRES_TIMESTAMP_TZ_OID);
    const parseZonedArray = fallback.getTypeParser(POSTGRES_TIMESTAMP_TZ_ARRAY_OID);

    // The text form is `YYYY-MM-DD HH:MM:SS[.ffffff][ BC]`: the marker goes
    // right after the time part, and `infinity` (no space) passes unchanged.
    const parseTimestamp : TypeParser = (value) => parseZoned(value.replace(/^(\S+ \S+)/, '$1Z'));
    const parseTimestampArray : TypeParser = (value) => parseZonedArray(value.replace(POSTGRES_ARRAY_TIMESTAMP, '$1Z'));

    return markInstalled({
        getTypeParser(oid: number, format?: 'text' | 'binary') {
            if (format !== 'binary') {
                if (oid === POSTGRES_TIMESTAMP_OID) {
                    return parseTimestamp;
                }

                if (oid === POSTGRES_TIMESTAMP_ARRAY_OID) {
                    return parseTimestampArray;
                }
            }

            return types.getTypeParser(oid, format);
        },
    });
}

/**
 * Derive a pg `Client` class which sends Date parameters as UTC. Left to pg,
 * a Date is sent with the offset of the Node process, which postgres drops
 * for a `timestamp without time zone`, storing the process's wall clock.
 * pg-pool takes the class through its `Client` option, so this stays scoped
 * to one pool.
 *
 * A stream (pg-query-stream / pg-cursor) prepares its values before the
 * client sees them, so those arrive in pg's local form and are re-serialized.
 */
export function createPostgresUTCClient<T extends new (...args: any[]) => any>(Base: T) : T {
    const Client = class extends Base {
        query(config: any, values?: any, callback?: any) {
            if (Array.isArray(values)) {
                return super.query(config, values.map((value) => toPostgresUTCParameter(value)), callback);
            }

            if (config && typeof config === 'object') {
                if (config.cursor && Array.isArray(config.cursor.values)) {
                    config.cursor.values = config.cursor.values.map((value: unknown) => toPostgresUTCPreparedParameter(value));
                } else if (Array.isArray(config.values)) {
                    if (typeof config.submit === 'function') {
                        // a submittable keeps its identity; its values are its own
                        config.values = config.values.map((value: unknown) => toPostgresUTCParameter(value));
                    } else {
                        return super.query({
                            ...config,
                            values: config.values.map((value: unknown) => toPostgresUTCParameter(value)),
                        }, values, callback);
                    }
                }
            }

            return super.query(config, values, callback);
        }
    };

    return markInstalled(Client);
}

function readTimezoneOption(options: string | undefined) : string | undefined {
    if (typeof options !== 'string') {
        return undefined;
    }

    const match = POSTGRES_TIMEZONE_OPTION.exec(options);
    return match ? match[1] : undefined;
}

/**
 * Add `-c TimeZone=UTC` to a set of startup options, or accept a TimeZone
 * already there when it names UTC. Any other zone is a conflict.
 */
function pinTimezoneOption(options: string, source: string) : string {
    const zone = readTimezoneOption(options);
    if (typeof zone === 'undefined') {
        return `${options} -c TimeZone=UTC`.trim();
    }

    if (POSTGRES_UTC_ZONE.test(zone)) {
        return options;
    }

    throw OptionsError.timezoneConflict(`${source} sets the postgres TimeZone to ${zone}.`);
}

/**
 * pg lets the `options` parameter of a connection string override
 * `extra.options`, so a url carrying one gets the pin there instead.
 */
function pinUrl(url: string | undefined) : string | undefined {
    if (typeof url !== 'string') {
        return url;
    }

    const index = url.indexOf('?');
    if (index === -1) {
        return url;
    }

    const params = new URLSearchParams(url.slice(index + 1));
    const current = params.get('options');
    if (current === null) {
        return url;
    }

    params.set('options', pinTimezoneOption(current, 'The connection url'));

    return `${url.slice(0, index)}?${params.toString()}`;
}

function isPostgresNativeInUse(nativeDriver: unknown, driver: Record<string, any>) : boolean {
    // mirrors typeorm's loadDependencies, including its swallowed errors
    try {
        let native = nativeDriver;
        if (native === null || typeof native === 'undefined') {
            native = PlatformTools.load('pg-native');
        }

        return !!(native && driver.native);
    } catch {
        return false;
    }
}

/**
 * Pin a postgres data source: `-c TimeZone=UTC` for the session, parsers
 * reading `timestamp without time zone` (and its array) as UTC, and a client
 * sending Date parameters as UTC.
 *
 * The TimeZone goes where pg reads it: the connection url's `options` when it
 * has one (pg lets those win), otherwise `extra.options`, which keeps an
 * existing `PGOPTIONS` since pg would stop reading it. A user's `extra.types`
 * and `extra.Client` are built upon. A foreign TimeZone, or timestamp parsers
 * overridden process-wide or in `extra.types`, is a conflict.
 */
export function applyPostgresTimezone(options: PostgresDataSourceOptions) : PostgresDataSourceOptions {
    const extra : Record<string, any> = { ...(options.extra ?? {}) };

    if (isInstalled(extra.types)) {
        return options;
    }

    const driver = options.driver ?? PlatformTools.load('pg');

    const global : PostgresTypes = driver.types;
    if (
        global.getTypeParser(POSTGRES_TIMESTAMP_OID) !== global.getTypeParser(POSTGRES_TIMESTAMP_TZ_OID) ||
        global.getTypeParser(POSTGRES_TIMESTAMP_ARRAY_OID) !== global.getTypeParser(POSTGRES_TIMESTAMP_TZ_ARRAY_OID)
    ) {
        throw OptionsError.timezoneConflict('the pg timestamp type parsers are overridden process-wide.');
    }

    const own : PostgresTypes | undefined = extra.types;
    if (
        own &&
        (
            own.getTypeParser(POSTGRES_TIMESTAMP_OID) !== own.getTypeParser(POSTGRES_TIMESTAMP_TZ_OID) ||
            own.getTypeParser(POSTGRES_TIMESTAMP_ARRAY_OID) !== own.getTypeParser(POSTGRES_TIMESTAMP_TZ_ARRAY_OID)
        )
    ) {
        throw OptionsError.timezoneConflict('extra.types overrides the timestamp type parsers.');
    }

    const output : Record<string, any> = { ...options };

    // session: pg reads extra.options for every connection, unless the
    // connection url carries `options` of its own, which then win for it
    const base = typeof extra.options === 'string' ? extra.options : (process.env.PGOPTIONS ?? '');
    extra.options = pinTimezoneOption(base, typeof extra.options === 'string' ? 'extra.options' : 'PGOPTIONS');

    output.url = pinUrl(options.url);
    if (options.replication) {
        const pinNode = <N extends { url?: string }>(node: N) : N => (typeof node.url === 'string' ?
            { ...node, url: pinUrl(node.url) } :
            node);

        output.replication = {
            ...options.replication,
            master: pinNode(options.replication.master),
            slaves: options.replication.slaves.map((slave) => pinNode(slave)),
        };
    }

    // reader
    extra.types = createPostgresUTCTypes(own ?? global, global);

    // writer
    const Base = extra.Client ?? (
        isPostgresNativeInUse(options.nativeDriver, driver) ?
            driver.native.Client :
            driver.Client
    );
    extra.Client = createPostgresUTCClient(Base);

    output.extra = extra;

    return output as PostgresDataSourceOptions;
}
