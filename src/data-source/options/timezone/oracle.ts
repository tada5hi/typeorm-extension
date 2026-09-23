import type { OracleDataSourceOptions } from 'typeorm/driver/oracle/OracleDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { OptionsError } from '../../../errors';
import type { MethodReplacer } from './type';
import { isDate, isInstalled, markInstalled } from './utils';

const ORACLE_SESSION_TIMEZONE_SQL = 'ALTER SESSION SET TIME_ZONE = \'+00:00\'';

type OracleCallback = (err?: unknown, ...rest: any[]) => void;
type OracleSessionCallback = (connection: any, requestedTag: string, callback: OracleCallback) => void;

/**
 * Re-read the local fields of a Date as UTC. node-oracledb builds a zone-less
 * `TIMESTAMP` as a local Date from its fields, and offers no switch for it.
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
 * The reverse: a local Date whose fields are the UTC fields of the given one.
 * node-oracledb binds a Date as a zone-less `TIMESTAMP` from its local
 * fields, so this sends the UTC wall clock with the column's own type, which
 * keeps an index on the column usable (a `TIMESTAMP WITH TIME ZONE` bind
 * would convert the column side of every comparison).
 */
export function writeUTCAsLocalDate(date: Date) : Date {
    const output = new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
    );

    const year = date.getUTCFullYear();
    if (year >= 0 && year < 100) {
        output.setFullYear(year);
    }

    return output;
}

/**
 * Proxy an object, replacing the named methods. Every function is bound to
 * the object itself, so its internals never re-enter the proxy, and cached,
 * so reading it twice gives the same function. A member carrying a
 * `prototype` which is not replaced (an exported class) passes through
 * untouched, which keeps `instanceof` and statics working.
 */
function proxyMethods<T extends object>(target: T, methods: Record<string, MethodReplacer>) : T {
    const cache = new Map<PropertyKey, { source: unknown, value: unknown }>();

    return new Proxy(target, {
        get(object, property) {
            const value = Reflect.get(object, property, object);
            if (typeof value !== 'function') {
                return value;
            }

            const cached = cache.get(property);
            if (cached && cached.source === value) {
                return cached.value;
            }

            const replace = typeof property === 'string' ? methods[property] : undefined;
            let output : unknown;
            if (replace) {
                output = replace(value.bind(object));
            } else if (Object.prototype.hasOwnProperty.call(value, 'prototype')) {
                output = value;
            } else {
                output = value.bind(object);
            }

            cache.set(property, { source: value, value: output });

            return output;
        },
    });
}

/**
 * Wrap a `node-oracledb` module so the connections it hands out (pooled or
 * standalone, the latter with the session pinned too) read a zone-less
 * `TIMESTAMP` as UTC, return `TIMESTAMP`
 * out-binds as UTC and send Date parameters as UTC wall clock. The module
 * exposes the read conversion only process-wide (`oracledb.fetchTypeHandler`)
 * or per `execute()` call, so the handler is added to every call a wrapped
 * connection makes. A handler the caller passes, or the process-wide one,
 * still decides first.
 *
 * In a process zone with daylight saving, a UTC wall clock falling into the
 * local spring-forward hour has no local Date to travel as: such a value is
 * read, and written, an hour late. A process running in UTC is exact.
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

    const toBindValue = (value: unknown) : unknown => {
        if (isDate(value)) {
            return writeUTCAsLocalDate(value);
        }

        if (Array.isArray(value)) {
            return value.map((element) => (isDate(element) ? writeUTCAsLocalDate(element) : element));
        }

        return value;
    };

    // A DATE is read back from its local fields (typeorm's `date` columns are
    // calendar dates), so a bind typed as one keeps its local fields too.
    const isZonelessType = (type: unknown) => typeof type === 'undefined' ||
        type === driver.DB_TYPE_TIMESTAMP;

    const toBind = (value: unknown) : unknown => {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            !isDate(value) &&
            'val' in value
        ) {
            const definition = value as Record<string, any>;
            return isZonelessType(definition.type) ?
                { ...definition, val: toBindValue(definition.val) } :
                definition;
        }

        return toBindValue(value);
    };

    /**
     * A row of `executeMany` holds plain values whose types, if any, come from
     * `bindDefs`: only a Date without one, or typed TIMESTAMP, is shifted.
     */
    const toRow = (row: unknown, definitions: unknown) : unknown => {
        const shift = (value: unknown, definition: unknown) => {
            const type = definition && typeof definition === 'object' ?
                (definition as Record<string, any>).type :
                undefined;

            return isZonelessType(type) ? toBindValue(value) : value;
        };

        if (Array.isArray(row)) {
            return row.map((value, index) => shift(value, Array.isArray(definitions) ? definitions[index] : undefined));
        }

        if (row && typeof row === 'object') {
            const output : Record<string, unknown> = {};
            const keys = Object.keys(row);
            for (const key of keys) {
                const definition = definitions && typeof definitions === 'object' && !Array.isArray(definitions) ?
                    (definitions as Record<string, unknown>)[key] :
                    undefined;
                output[key] = shift((row as Record<string, unknown>)[key], definition);
            }

            return output;
        }

        return row;
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

    // An INOUT bind without a type takes its type from its value: a Date
    // travels as TIMESTAMP, and returns as one.
    const isTimestampOut = (definition: unknown) : boolean => {
        if (!definition || typeof definition !== 'object' || isDate(definition)) {
            return false;
        }

        const {
            type, 
            dir, 
            val, 
        } = definition as Record<string, any>;
        if (dir !== driver.BIND_OUT && dir !== driver.BIND_INOUT) {
            return false;
        }

        return type === driver.DB_TYPE_TIMESTAMP ||
            (typeof type === 'undefined' && dir === driver.BIND_INOUT && isDate(val));
    };

    const readOut = (value: unknown) : unknown => {
        if (isDate(value)) {
            return readLocalDateAsUTC(value);
        }

        if (Array.isArray(value)) {
            return value.map((element) => (isDate(element) ? readLocalDateAsUTC(element) : element));
        }

        return value;
    };

    const convertOutBinds = (outBinds: unknown, definitions: unknown) : unknown => {
        if (!outBinds || typeof outBinds !== 'object' || !definitions || typeof definitions !== 'object') {
            return outBinds;
        }

        if (Array.isArray(definitions)) {
            // positional: out-binds are listed in the order of the out definitions
            if (!Array.isArray(outBinds)) {
                return outBinds;
            }

            const outs = definitions.filter((definition) => !!definition &&
                typeof definition === 'object' &&
                !isDate(definition) &&
                ((definition as Record<string, any>).dir === driver.BIND_OUT ||
                    (definition as Record<string, any>).dir === driver.BIND_INOUT));

            return outBinds.map((value, index) => (isTimestampOut(outs[index]) ? readOut(value) : value));
        }

        const output : Record<string, unknown> = { ...(outBinds as Record<string, unknown>) };
        const keys = Object.keys(output);
        for (const key of keys) {
            if (isTimestampOut((definitions as Record<string, unknown>)[key])) {
                output[key] = readOut(output[key]);
            }
        }

        return output;
    };

    const convertResult = (result: any, definitions: unknown) => {
        if (result && typeof result === 'object' && typeof result.outBinds !== 'undefined') {
            result.outBinds = convertOutBinds(result.outBinds, definitions);
        }

        return result;
    };

    const convertManyResult = (result: any, definitions: unknown) => {
        if (result && typeof result === 'object' && Array.isArray(result.outBinds)) {
            result.outBinds = result.outBinds.map((row: unknown) => convertOutBinds(row, definitions));
        }

        return result;
    };

    const settle = (outcome: any, definitions: unknown, callback: unknown, convert: (result: any, definitions: unknown) => any) => {
        if (typeof callback === 'function') {
            return outcome;
        }

        return outcome && typeof outcome.then === 'function' ?
            outcome.then((result: any) => convert(result, definitions)) :
            outcome;
    };

    const wrapConnection = (connection: Record<string, any>) => proxyMethods(connection, {
        execute: (original) => (sql: unknown, binds?: unknown, options?: unknown, callback?: unknown) => {
            if (typeof binds === 'function') {
                return original(sql, {}, withHandler(), binds);
            }

            const input = binds ?? {};
            const optionsOrCallback = typeof options === 'function' ? undefined : options as Record<string, any> | undefined;
            const done = typeof options === 'function' ? options : callback;

            if (typeof done === 'function') {
                return original(sql, toBinds(input), withHandler(optionsOrCallback), (err: unknown, result: any) => {
                    done(err, err ? result : convertResult(result, input));
                });
            }

            return settle(original(sql, toBinds(input), withHandler(optionsOrCallback)), input, undefined, convertResult);
        },
        executeMany: (original) => (sql: unknown, binds: unknown, options?: unknown, callback?: unknown) => {
            const optionsOrCallback = typeof options === 'function' ? undefined : options as Record<string, any> | undefined;
            const done = typeof options === 'function' ? options : callback;
            const definitions = optionsOrCallback?.bindDefs;
            const rows = Array.isArray(binds) ? binds.map((row) => toRow(row, definitions)) : binds;

            if (typeof done === 'function') {
                return original(sql, rows, optionsOrCallback ?? {}, (err: unknown, result: any) => {
                    done(err, err ? result : convertManyResult(result, definitions));
                });
            }

            return settle(original(sql, rows, optionsOrCallback ?? {}), definitions, undefined, convertManyResult);
        },
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

    const wrapFactory = (wrap: (value: Record<string, any>) => Record<string, any>) : MethodReplacer => (original) => (...args: any[]) => {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
            return original(...args.slice(0, -1), (err: unknown, value?: Record<string, any>) => {
                callback(err, value ? wrap(value) : value);
            });
        }

        const output = original(...args);
        if (output && typeof output.then === 'function') {
            return output.then((value: Record<string, any>) => wrap(value));
        }

        return output ? wrap(output) : output;
    };

    // A standalone connection gets no pool sessionCallback, so it is pinned
    // before it is handed out.
    const pinConnection = (connection: Record<string, any>) : Promise<Record<string, any>> => Promise
        .resolve(connection.execute(ORACLE_SESSION_TIMEZONE_SQL))
        .then(
            () => wrapConnection(connection),
            // a connection left in another zone is closed rather than handed out
            (error) => Promise.resolve(connection.close())
                .catch(() => undefined)
                .then(() => Promise.reject(error)),
        );

    return markInstalled(proxyMethods(driver, {
        createPool: wrapFactory(wrapPool),
        getPool: (original) => (...args: any[]) => {
            const pool = original(...args);
            return pool ? wrapPool(pool) : pool;
        },
        getConnection: (original) => (...args: any[]) => {
            const callback = args[args.length - 1];
            if (typeof callback === 'function') {
                return original(...args.slice(0, -1), (err: unknown, connection?: Record<string, any>) => {
                    if (err || !connection) {
                        callback(err, connection);
                        return;
                    }

                    pinConnection(connection).then(
                        (value) => callback(null, value),
                        (error) => callback(error),
                    );
                });
            }

            return original(...args).then((connection: Record<string, any>) => pinConnection(connection));
        },
    }));
}

/**
 * Pin an oracle data source: a pool `sessionCallback` running
 * `ALTER SESSION SET TIME_ZONE`, and a driver whose connections read a
 * zone-less `TIMESTAMP` as UTC and send Date parameters as UTC wall clock.
 * A `sessionCallback` function the caller set runs after the pin; one naming
 * a PL/SQL procedure can not be combined and is a conflict.
 */
export function applyOracleTimezone(options: OracleDataSourceOptions) : OracleDataSourceOptions {
    if (isInstalled(options.driver)) {
        if (isInstalled(options.extra?.sessionCallback)) {
            return options;
        }

        throw OptionsError.timezoneConflict('the oracle pin was altered after it was applied.');
    }

    const existing : unknown = options.extra?.sessionCallback;
    if (typeof existing !== 'undefined' && typeof existing !== 'function') {
        throw OptionsError.timezoneConflict('the oracle sessionCallback names a PL/SQL procedure, which can not run after the session pin.');
    }

    const sessionCallback : OracleSessionCallback = markInstalled((connection, requestedTag, callback) => {
        connection.execute(ORACLE_SESSION_TIMEZONE_SQL, (err: unknown) => {
            if (err || typeof existing !== 'function') {
                callback(err ?? undefined);
                return;
            }

            (existing as OracleSessionCallback)(connection, requestedTag, callback);
        });
    });

    const driver = options.driver ?? PlatformTools.load('oracledb');

    return {
        ...options,
        driver: createOracleUTCDriver(driver),
        extra: {
            ...(options.extra ?? {}),
            sessionCallback,
        },
    };
}
