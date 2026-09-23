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
 * A `TimeZone` assignment among the postgres startup options, in either
 * spelling the server accepts (`-c TimeZone=...`, `--TimeZone=...`). The
 * name is matched whole: `log_timezone` sets something else entirely.
 */
const POSTGRES_TIMEZONE_OPTION = /(?:^|\s)(?:-c\s*|--)timezone=(\S+)/gi;

const POSTGRES_UTC_ZONE = /^(?:utc|uct|etc\/utc|etc\/uct|universal|etc\/universal|zulu|etc\/zulu|z|gmt|gmt0|etc\/gmt|etc\/gmt0|etc\/gmt[+-]0|greenwich|etc\/greenwich|[+-]?0{1,2}(?::?00)?)$/i;

/**
 * The text form of a `timestamp without time zone` (ISO DateStyle).
 */
const POSTGRES_TIMESTAMP = /^(\d{4,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d+)?( BC)?$/;

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

/**
 * A submittable (pg Query, pg-cursor, pg-query-stream) may already hold its
 * values in pg's prepared form: pg-cursor applies pg's `prepareValue` in its
 * constructor, before the client sees it.
 */
function toPostgresUTCSubmittedParameter(value: unknown) : unknown {
    if (isDate(value)) {
        return serializePostgresDateAsUTC(value);
    }

    return reserializePostgresLocalDateAsUTC(value);
}

/**
 * Parse the text form of a `timestamp without time zone` as UTC: the same
 * fields, BC years and `infinity` pg's own parser handles, read in UTC rather
 * than in the zone of the process. Another text form (a non-ISO DateStyle)
 * gives `null`, as it does there.
 */
export function parsePostgresTimestampAsUTC(value: string) : Date | number | null {
    if (value === 'infinity') {
        return Infinity;
    }

    if (value === '-infinity') {
        return -Infinity;
    }

    const match = POSTGRES_TIMESTAMP.exec(value);
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second, fraction, bc] = match;

    let fullYear = Number(year);
    if (bc) {
        fullYear = 1 - fullYear;
    }

    const date = new Date(0);
    date.setUTCFullYear(fullYear, Number(month) - 1, Number(day));
    date.setUTCHours(
        Number(hour),
        Number(minute),
        Number(second),
        fraction ? Math.floor(Number(fraction) * 1000) : 0,
    );

    return date;
}

/**
 * Parse the text form of a postgres array, handing each element to the given
 * parser. Covers what pg emits for a `timestamp[]`: quoted and unquoted
 * elements, `NULL` and nested arrays.
 */
export function parsePostgresArray<T>(value: string, parse: (element: string) => T) : unknown[] {
    let position = 0;

    const parseLevel = () : unknown[] => {
        const output : unknown[] = [];
        position++; // `{`

        while (position < value.length) {
            const char = value[position];

            if (char === '}') {
                position++;
                return output;
            }

            if (char === ',') {
                position++;
            } else if (char === '{') {
                output.push(parseLevel());
            } else if (char === '"') {
                let element = '';
                position++;
                while (position < value.length && value[position] !== '"') {
                    if (value[position] === '\\') {
                        position++;
                    }
                    element += value[position];
                    position++;
                }
                position++; // closing quote
                output.push(parse(element));
            } else {
                let element = '';
                while (position < value.length && value[position] !== ',' && value[position] !== '}') {
                    element += value[position];
                    position++;
                }
                output.push(element === 'NULL' ? null : parse(element));
            }
        }

        return output;
    };

    // an optional dimension decoration (`[0:1]={...}`) precedes the array
    const brace = value.indexOf('{');
    if (brace === -1) {
        return [];
    }

    position = brace;
    return parseLevel();
}

const parsePostgresTimestampArrayAsUTC : TypeParser = (value) => parsePostgresArray(value, parsePostgresTimestampAsUTC);

/**
 * Build postgres type parsers which read `timestamp without time zone` (and
 * its array) as UTC and delegate every other type to the given registry.
 */
export function createPostgresUTCTypes(types: PostgresTypes) : PostgresTypes {
    return markInstalled({
        getTypeParser(oid: number, format?: 'text' | 'binary') {
            if (format !== 'binary') {
                if (oid === POSTGRES_TIMESTAMP_OID) {
                    return parsePostgresTimestampAsUTC as TypeParser;
                }

                if (oid === POSTGRES_TIMESTAMP_ARRAY_OID) {
                    return parsePostgresTimestampArrayAsUTC;
                }
            }

            return types.getTypeParser(oid, format);
        },
    });
}

/**
 * Whether a registry still parses zone-less timestamps the way pg does by
 * default (a local Date), judged by behaviour: a custom parser registered for
 * them (strings, another date library) is a choice the pin would override.
 */
function isDefaultTimestampParsing(types: PostgresTypes) : boolean {
    const expected = new Date(2000, 0, 2, 3, 4, 5).getTime();

    try {
        const single = types.getTypeParser(POSTGRES_TIMESTAMP_OID)('2000-01-02 03:04:05');
        const many = types.getTypeParser(POSTGRES_TIMESTAMP_ARRAY_OID)('{"2000-01-02 03:04:05"}') as unknown;

        return single instanceof Date &&
            single.getTime() === expected &&
            Array.isArray(many) &&
            many[0] instanceof Date &&
            many[0].getTime() === expected;
    } catch {
        return false;
    }
}

/**
 * Derive a pg `Client` class which sends Date parameters as UTC. Left to pg,
 * a Date is sent with the offset of the Node process, which postgres drops
 * for a `timestamp without time zone`, storing the process's wall clock.
 * pg-pool takes the class through its `Client` option, so this stays scoped
 * to one pool.
 *
 * A stream (pg-query-stream / pg-cursor) prepares its values before the
 * client sees them, so those arrive in pg's local form and are re-serialized;
 * a Date inside an array value of a stream arrives as an array literal and is
 * not.
 */
export function createPostgresUTCClient<T extends new (...args: any[]) => any>(Base: T) : T {
    const Client = class extends Base {
        query(config: any, values?: any, callback?: any) {
            if (Array.isArray(values)) {
                return super.query(config, values.map((value) => toPostgresUTCParameter(value)), callback);
            }

            if (config && typeof config === 'object') {
                if (config.cursor && Array.isArray(config.cursor.values)) {
                    // pg-query-stream: the values sit on its cursor
                    config.cursor.values = config.cursor.values.map((value: unknown) => toPostgresUTCSubmittedParameter(value));
                } else if (Array.isArray(config.values)) {
                    if (typeof config.submit === 'function') {
                        // a submittable keeps its identity; its values are its own
                        config.values = config.values.map((value: unknown) => toPostgresUTCSubmittedParameter(value));
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

/**
 * The TimeZone a set of startup options assigns. Postgres applies them in
 * order, so the last assignment is the one in effect.
 */
function readTimezoneOption(options: string | undefined) : string | undefined {
    if (typeof options !== 'string') {
        return undefined;
    }

    let zone : string | undefined;
    for (const match of options.matchAll(POSTGRES_TIMEZONE_OPTION)) {
        [, zone] = match;
    }

    return typeof zone === 'string' ? zone.replace(/^'(.*)'$/, '$1') : undefined;
}

function isUTCZone(zone: string) : boolean {
    return POSTGRES_UTC_ZONE.test(zone);
}

/**
 * Add `-c TimeZone=UTC` to a set of startup options, or accept a TimeZone
 * already in effect there when it names UTC. Any other zone is a conflict.
 */
function pinTimezoneOption(options: string, source: string) : string {
    const zone = readTimezoneOption(options);
    if (typeof zone === 'undefined') {
        return `${options} -c TimeZone=UTC`.trim();
    }

    if (isUTCZone(zone)) {
        return options;
    }

    throw OptionsError.timezoneConflict(`${source} sets the postgres TimeZone to ${zone}.`);
}

/**
 * Take the `options` parameter out of a connection string, leaving every
 * other byte of it as it was (re-encoding it can break a string pg would
 * have accepted). Postgres uses the last occurrence, and so does this.
 */
export function extractPostgresUrlOptions(url: string) : { url: string, options?: string } {
    const index = url.indexOf('?');
    if (index === -1) {
        return { url };
    }

    const hash = url.indexOf('#', index);
    const query = url.slice(index + 1, hash === -1 ? undefined : hash);
    const rest = hash === -1 ? '' : url.slice(hash);

    let options : string | undefined;
    const kept : string[] = [];
    for (const segment of query.split('&')) {
        const params = new URLSearchParams(segment);
        if (params.has('options')) {
            options = params.get('options') ?? '';
        } else if (segment.length > 0) {
            kept.push(segment);
        }
    }

    return {
        url: url.slice(0, index) + (kept.length > 0 ? `?${kept.join('&')}` : '') + rest,
        options,
    };
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
 * pg takes the startup options from the connection string first, then
 * `extra.options`, then `PGOPTIONS`; the options in effect are moved into
 * `extra.options` (out of the connection string, byte for byte otherwise)
 * and the pin is added there. A user's `extra.types` (for other types) and
 * `extra.Client` are built upon. A foreign TimeZone in effect, timestamp
 * parsing customised process-wide or in `extra.types`, or a replication node
 * url carrying options (shared `extra` can not hold per-node options) is a
 * conflict, and so is a pin altered after it was applied.
 */
export function applyPostgresTimezone(options: PostgresDataSourceOptions) : PostgresDataSourceOptions {
    const extra : Record<string, any> = { ...(options.extra ?? {}) };

    if (isInstalled(extra.types) || isInstalled(extra.Client)) {
        const zone = readTimezoneOption(extra.options);
        const nodes = options.replication ? [options.replication.master, ...options.replication.slaves] : [];
        const urls = [options.url, extra.connectionString, ...nodes.map((node) => node.url)]
            .filter((url) => typeof url === 'string') as string[];
        if (
            isInstalled(extra.types) &&
            isInstalled(extra.Client) &&
            typeof zone === 'string' &&
            isUTCZone(zone) &&
            urls.every((url) => typeof extractPostgresUrlOptions(url).options === 'undefined')
        ) {
            return options;
        }

        throw OptionsError.timezoneConflict('the postgres pin was altered after it was applied.');
    }

    const driver = options.driver ?? PlatformTools.load('pg');

    if (!isDefaultTimestampParsing(driver.types)) {
        throw OptionsError.timezoneConflict('timestamp parsing is customised process-wide (pg.types.setTypeParser).');
    }

    const own : PostgresTypes | undefined = extra.types;
    if (own && !isDefaultTimestampParsing(own)) {
        throw OptionsError.timezoneConflict('extra.types customises timestamp parsing.');
    }

    const output : Record<string, any> = { ...options };

    // session
    let fromUrl : string | undefined;
    if (typeof options.url === 'string') {
        const extracted = extractPostgresUrlOptions(options.url);
        output.url = extracted.url;
        fromUrl = extracted.options;
    }

    if (typeof extra.connectionString === 'string') {
        // typeorm merges extra last: this string replaces the url entirely
        const extracted = extractPostgresUrlOptions(extra.connectionString);
        extra.connectionString = extracted.url;
        fromUrl = extracted.options;
    }

    if (options.replication) {
        const nodes = [options.replication.master, ...options.replication.slaves];
        if (nodes.some((node) => typeof node.url === 'string' && typeof extractPostgresUrlOptions(node.url).options !== 'undefined')) {
            throw OptionsError.timezoneConflict('a replication node url carries startup options, which can not be combined with the pin.');
        }
    }

    let source = 'PGOPTIONS';
    let base = process.env.PGOPTIONS ?? '';
    if (typeof fromUrl === 'string') {
        source = 'the connection url';
        base = fromUrl;
    } else if (typeof extra.options === 'string') {
        source = 'extra.options';
        base = extra.options;
    }

    extra.options = pinTimezoneOption(base, source);

    // reader
    extra.types = createPostgresUTCTypes(own ?? driver.types);

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
