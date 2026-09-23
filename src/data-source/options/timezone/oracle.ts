import type { OracleDataSourceOptions } from 'typeorm/driver/oracle/OracleDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import type { MethodReplacer } from './type';
import { isDate } from './utils';

const ORACLE_SESSION_TIMEZONE_SQL = 'ALTER SESSION SET TIME_ZONE = \'+00:00\'';

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

/**
 * Pin an oracle data source: a pool `sessionCallback` running
 * `ALTER SESSION SET TIME_ZONE`, and a driver whose pooled connections read a
 * zone-less `TIMESTAMP` as UTC and bind Date parameters as instants. An
 * `extra.sessionCallback` already set returns the options unchanged.
 */
export function applyOracleTimezone(options: OracleDataSourceOptions) : OracleDataSourceOptions {
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
