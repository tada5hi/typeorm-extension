import type { DataSourceOptions } from 'typeorm';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { OptionsError } from '../../../errors';

/**
 * The timezones a data source can be pinned to. Only UTC can be expressed
 * on both sides: a zone-less value can be read as UTC by appending a marker,
 * while any other zone needs the offset in force at that instant.
 */
export type DataSourceTimezone = 'UTC';

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

const MYSQL_SESSION_TIMEZONE_SQL = 'SET time_zone = \'+00:00\'';

const ORACLE_SESSION_TIMEZONE_SQL = 'ALTER SESSION SET TIME_ZONE = \'+00:00\'';

type TypeParser = (value: string) => unknown;
type PostgresTypes = {
    getTypeParser: (oid: number, format?: 'text' | 'binary') => TypeParser,
};
type MysqlConnection = {
    query: (sql: string, callback: (err: unknown) => void) => unknown,
    destroy: () => void,
};
type MysqlPool = {
    on: (event: string, listener: (connection: MysqlConnection) => void) => unknown,
};
type MysqlModule = {
    createPool: (...args: any[]) => MysqlPool,
    [key: string]: any,
};
type MethodReplacer = (original: (...args: any[]) => any) => (...args: any[]) => any;

export function isDataSourceTimezone(input: unknown) : input is DataSourceTimezone {
    return typeof input === 'string' && input.toUpperCase() === 'UTC';
}

function isDate(input: unknown) : input is Date {
    return input instanceof Date ||
        Object.prototype.toString.call(input) === '[object Date]';
}

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

/**
 * Wrap a `mysql2` module so every pool pins its connections to UTC. The pool
 * emits `connection` synchronously, before it hands a new connection out, and
 * a connection runs its queries in order, so the `SET` is the first statement
 * every connection executes. A connection whose `SET` fails is destroyed
 * rather than left running in another zone.
 */
export function createMysqlUTCDriver<T extends MysqlModule>(driver: T) : T {
    return {
        ...driver,
        createPool(...args: any[]) {
            const pool = driver.createPool(...args);
            pool.on('connection', (connection) => {
                connection.query(MYSQL_SESSION_TIMEZONE_SQL, (err) => {
                    if (err) {
                        connection.destroy();
                    }
                });
            });

            return pool;
        },
    };
}

/**
 * Re-read the local fields of a Date as UTC. node-oracledb builds a zone-less
 * `TIMESTAMP` as a local Date from its fields, and offers no switch for it.
 * Exact for a process in UTC; in a zone with daylight saving, a value whose
 * fields fall into the local spring-forward gap arrives an hour late.
 */
export function readLocalDateAsUTC(date: Date) : Date {
    const output = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
    ));

    // Date.UTC maps the years 0 to 99 onto 1900 to 1999.
    const year = date.getFullYear();
    if (year >= 0 && year < 100) {
        output.setUTCFullYear(year);
    }

    return output;
}

/**
 * Proxy an object, replacing the named methods. The replaced methods and
 * every other method are bound to the object itself, so its internals never
 * re-enter the proxy. A member carrying a `prototype` which is not replaced
 * (an exported class, or a plain function) passes through untouched, which
 * keeps `instanceof` and statics working.
 */
function proxyMethods<T extends object>(target: T, methods: Record<string, MethodReplacer>) : T {
    return new Proxy(target, {
        get(object, property) {
            const value = Reflect.get(object, property, object);
            if (typeof value !== 'function') {
                return value;
            }

            const replace = typeof property === 'string' ? methods[property] : undefined;
            if (replace) {
                return replace(value.bind(object));
            }

            if (Object.prototype.hasOwnProperty.call(value, 'prototype')) {
                return value;
            }

            return value.bind(object);
        },
    });
}

/**
 * Wrap a `node-oracledb` module so the connections of its pools read a
 * zone-less `TIMESTAMP` as UTC and send Date parameters as instants. The
 * module exposes the conversion only process-wide (`oracledb.fetchTypeHandler`)
 * or per `execute()` call, so the handler is added to every call a pooled
 * connection makes. A handler the caller passes, or the process-wide one,
 * still decides first.
 */
export function createOracleUTCDriver<T extends Record<string, any>>(driver: T) : T {
    const handleTimestamp = (metadata: { dbType?: unknown }) => {
        if (metadata.dbType !== driver.DB_TYPE_TIMESTAMP) {
            return undefined;
        }

        return { converter: (value: unknown) => (isDate(value) ? readLocalDateAsUTC(value) : value) };
    };

    const withHandler = (options?: Record<string, any>) => {
        const custom = options?.fetchTypeHandler ?? driver.fetchTypeHandler;

        return {
            ...(options ?? {}),
            fetchTypeHandler: (metadata: { dbType?: unknown }) => {
                const result = typeof custom === 'function' ? custom(metadata) : undefined;
                return typeof result === 'undefined' ? handleTimestamp(metadata) : result;
            },
        };
    };

    // A Date bound as it is travels as its LOCAL fields; bound as a
    // TIMESTAMP WITH TIME ZONE it travels as the instant, which the server
    // converts into the (UTC) session zone for a zone-less column.
    const toBind = (value: unknown) : unknown => {
        if (isDate(value)) {
            return { val: value, type: driver.DB_TYPE_TIMESTAMP_TZ };
        }

        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            isDate((value as Record<string, any>).val) &&
            typeof (value as Record<string, any>).type === 'undefined'
        ) {
            return { ...value, type: driver.DB_TYPE_TIMESTAMP_TZ };
        }

        return value;
    };

    const toBinds = (binds: unknown) : unknown => {
        if (Array.isArray(binds)) {
            return binds.map((value) => toBind(value));
        }

        if (binds && typeof binds === 'object') {
            const output : Record<string, unknown> = {};
            const keys = Object.keys(binds);
            for (const key of keys) {
                output[key] = toBind((binds as Record<string, unknown>)[key]);
            }

            return output;
        }

        return binds;
    };

    const wrapConnection = (connection: Record<string, any>) => proxyMethods(connection, {
        execute: (original) => (sql: unknown, binds?: unknown, options?: unknown, ...rest: unknown[]) => {
            if (typeof binds === 'function') {
                return original(sql, {}, withHandler(), binds);
            }
            if (typeof options === 'function') {
                return original(sql, toBinds(binds), withHandler(), options);
            }

            return original(sql, toBinds(binds ?? {}), withHandler(options as Record<string, any> | undefined), ...rest);
        },
        executeMany: (original) => (sql: unknown, binds: unknown, ...rest: unknown[]) => original(
            sql,
            Array.isArray(binds) ? binds.map((row) => toBinds(row)) : binds,
            ...rest,
        ),
        queryStream: (original) => (sql: unknown, binds?: unknown, options?: Record<string, any>) => original(
            sql,
            toBinds(binds ?? {}),
            withHandler(options),
        ),
    });

    const wrapPool = (pool: Record<string, any>) => proxyMethods(pool, {
        getConnection: (original) => (...args: any[]) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                return original(...args.slice(0, -1), (err: unknown, connection?: Record<string, any>, ...rest: unknown[]) => {
                    callback(err, connection ? wrapConnection(connection) : connection, ...rest);
                });
            }

            return original(...args).then((connection: Record<string, any>) => wrapConnection(connection));
        },
    });

    return proxyMethods(driver, {
        createPool: (original) => (...args: any[]) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                return original(...args.slice(0, -1), (err: unknown, pool?: Record<string, any>) => {
                    callback(err, pool ? wrapPool(pool) : pool);
                });
            }

            return original(...args).then((pool: Record<string, any>) => wrapPool(pool));
        },
    });
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
 * Pin a data source to a timezone on BOTH sides: the database session that
 * stamps zone-less columns (`now()`, `CURRENT_TIMESTAMP`) and the driver that
 * writes and reads them. Left alone, the database stamps such a column in its
 * own session zone and the driver reads and writes it in the zone of the Node
 * process, which agree only while both clocks do.
 *
 * - postgres: `-c TimeZone=UTC` as a startup option, a pool type parser
 *   reading `timestamp without time zone` as UTC, and a pool client sending
 *   Date parameters as UTC.
 * - mysql / mariadb: `timezone: 'Z'` for mysql2 (reading and parameters),
 *   and pools that run `SET time_zone = '+00:00'` on every new connection.
 *   A replication setup (pool cluster) has no per-connection hook and is
 *   returned unchanged.
 * - oracle: a pool `sessionCallback` running `ALTER SESSION SET TIME_ZONE`,
 *   and connections reading a zone-less `TIMESTAMP` as UTC.
 * - every other driver is returned unchanged.
 *
 * All or nothing per driver: a setting the caller made on either side (a
 * mysql `timezone`; a postgres `TimeZone` startup option, `extra.types` or
 * `extra.Client`; an oracle `extra.sessionCallback`) returns the options
 * unchanged, since half a pin shifts values rather than fixing them. This is
 * also what makes the call idempotent. A given `driver` is wrapped instead of
 * the one typeorm would load.
 *
 * Only the session is pinned. Rows a database stamped in another zone before
 * keep that wall clock.
 */
export function withDataSourceTimezone<T extends DataSourceOptions>(
    options: T,
    timezone: DataSourceTimezone,
) : T {
    if (!isDataSourceTimezone(timezone)) {
        throw OptionsError.timezoneUnsupported(timezone);
    }

    if (options.type === 'mysql' || options.type === 'mariadb') {
        if (
            typeof options.timezone !== 'undefined' ||
            typeof options.replication !== 'undefined'
        ) {
            return options;
        }

        const driver = options.driver ?? PlatformTools.load('mysql2');

        return {
            ...options,
            timezone: 'Z',
            driver: createMysqlUTCDriver(driver),
        };
    }

    if (options.type === 'postgres') {
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

    if (options.type === 'oracle') {
        if (typeof options.extra?.sessionCallback !== 'undefined') {
            return options;
        }

        const driver = options.driver ?? PlatformTools.load('oracledb');

        return {
            ...options,
            driver: createOracleUTCDriver(driver),
            extra: {
                ...(options.extra ?? {}),
                sessionCallback: (connection: any, _requestedTag: string, callback: (err?: unknown) => void) => {
                    connection.execute(ORACLE_SESSION_TIMEZONE_SQL, (err: unknown) => callback(err ?? undefined));
                },
            },
        };
    }

    return options;
}
