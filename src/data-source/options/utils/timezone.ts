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

const MYSQL_SESSION_TIMEZONE_SQL = 'SET time_zone = \'+00:00\'';

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

export function isDataSourceTimezone(input: unknown) : input is DataSourceTimezone {
    return typeof input === 'string' && input.toUpperCase() === 'UTC';
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
 * Pin a data source to a timezone on BOTH sides: the database session that
 * stamps zone-less columns (`now()`, `CURRENT_TIMESTAMP`) and the driver that
 * reads them back. Left alone, the database stamps in its own session zone
 * and the driver reads in the zone of the Node process, which agree only
 * while both clocks do.
 *
 * - postgres: `-c TimeZone=UTC` as a startup option, and a pool type parser
 *   reading `timestamp without time zone` as UTC.
 * - mysql / mariadb: `timezone: 'Z'` for mysql2, and pools that run
 *   `SET time_zone = '+00:00'` on every new connection. A replication setup
 *   (pool cluster) has no per-connection hook and is returned unchanged.
 * - every other driver is returned unchanged.
 *
 * Settings already present win, which also makes the call idempotent: a
 * mysql `timezone`, a postgres `TimeZone` in `extra.options`, pg
 * `extra.types`. A given `driver` is wrapped (mysql) or used for delegation
 * (postgres) instead of the one typeorm would load.
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
        if (!/timezone/i.test(startup)) {
            extra.options = `${startup} -c TimeZone=UTC`.trim();
        }

        if (typeof extra.types === 'undefined') {
            const driver = options.driver ?? PlatformTools.load('pg');
            extra.types = createPostgresUTCTypes(driver.types);
        }

        return { ...options, extra };
    }

    return options;
}
