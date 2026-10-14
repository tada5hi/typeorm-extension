import type { MysqlDataSourceOptions } from 'typeorm/driver/mysql/MysqlDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { OptionsError } from '../../../errors';
import type {
    MysqlConnection,
    MysqlModule,
    MysqlPoolCluster,
    MysqlPoolConnectionCallback,
} from './type';
import { isInstalled, markInstalled } from './utils';

const MYSQL_SESSION_TIMEZONE_SQL = 'SET time_zone = \'+00:00\'';

/**
 * The mysql2 `timezone` values meaning UTC.
 */
const MYSQL_UTC_TIMEZONE = /^(?:z|[+-]00:00)$/i;

/**
 * Pin the sessions a pool cluster hands out. Its pools are built internally
 * (`PoolCluster.add`), so there is no `connection` event to listen to;
 * instead every connection is pinned on its way out, before the caller's
 * callback runs. Every way to a connection (`getConnection`, and the
 * `query` / `execute` of `of(pattern)`) passes through the namespace `of`
 * returns. A pooled session is handed out as the same object until it is
 * replaced, so the `SET` runs once per session. A connection whose `SET`
 * fails is destroyed and the error handed to the caller.
 */
function pinMysqlPoolCluster<T extends MysqlPoolCluster>(cluster: T) : T {
    const pinned = new WeakSet<MysqlConnection>();
    const wrapped = new WeakSet<object>();
    const of = cluster.of.bind(cluster);

    cluster.of = (...args: any[]) => {
        const namespace = of(...args);
        if (wrapped.has(namespace)) {
            return namespace;
        }

        const getConnection = namespace.getConnection.bind(namespace);
        namespace.getConnection = (callback: MysqlPoolConnectionCallback) => getConnection((err, connection) => {
            if (err || !connection || pinned.has(connection)) {
                callback(err, connection);
                return;
            }

            connection.query(MYSQL_SESSION_TIMEZONE_SQL, (queryError) => {
                if (queryError) {
                    connection.destroy();
                    callback(queryError);
                    return;
                }

                pinned.add(connection);
                callback(null, connection);
            });
        });
        wrapped.add(namespace);

        return namespace;
    };

    return cluster;
}

/**
 * Wrap a `mysql2` module so every pool and pool cluster pins its connections
 * to UTC. The pool emits `connection` synchronously, before it hands a new
 * connection out, and a connection runs its queries in order, so the `SET`
 * is the first statement every connection executes. A connection whose
 * `SET` fails is destroyed rather than left running in another zone.
 */
export function createMysqlUTCDriver<T extends MysqlModule>(driver: T) : T {
    return markInstalled({
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
        ...(typeof driver.createPoolCluster === 'function' ? {
            createPoolCluster(...args: any[]) {
                return pinMysqlPoolCluster(driver.createPoolCluster!(...args));
            },
        } : {}),
    });
}

function readSetting<K extends string>(options: Record<string, any>, key: K) : unknown {
    // typeorm merges `extra` over the options it passes to mysql2
    const extra = options.extra ?? {};
    return typeof extra[key] !== 'undefined' ? extra[key] : options[key];
}

/**
 * Pin a mysql / mariadb data source: the session runs `SET time_zone` on
 * every new pool connection (on every node of a replication setup), and
 * mysql2 reads and writes DATETIME and TIMESTAMP values as UTC (`timezone: 'Z'`). DATE values are returned as
 * strings (`dateStrings: ['DATE']`): a calendar date has no instant, and
 * mysql2 would otherwise hand it over as UTC midnight, which typeorm then
 * formats back in the process zone, a day early west of UTC.
 *
 * A `timezone` naming UTC and `dateStrings: ['DATE']` are accepted as they
 * are. Another `timezone`, other `dateStrings`, or a custom `typeCast` is a
 * conflict, and so is a pin altered after it was applied. typeorm builds
 * every replication node from the same `timezone`, `dateStrings` and
 * `extra`, so one check covers them all.
 */
export function applyMysqlTimezone(options: MysqlDataSourceOptions) : MysqlDataSourceOptions {
    if (isInstalled(options.driver)) {
        const timezone = readSetting(options, 'timezone');
        const dateStrings = readSetting(options, 'dateStrings');
        if (
            timezone === 'Z' &&
            Array.isArray(dateStrings) &&
            dateStrings.length === 1 &&
            dateStrings[0] === 'DATE' &&
            typeof readSetting(options, 'typeCast') === 'undefined'
        ) {
            return options;
        }

        throw OptionsError.timezoneConflict('the mysql pin was altered after it was applied.');
    }

    const timezone = readSetting(options, 'timezone');
    if (
        typeof timezone !== 'undefined' &&
        !(typeof timezone === 'string' && MYSQL_UTC_TIMEZONE.test(timezone))
    ) {
        throw OptionsError.timezoneConflict(`the mysql timezone is set to ${String(timezone)}.`);
    }

    const dateStrings = readSetting(options, 'dateStrings');
    if (
        typeof dateStrings !== 'undefined' &&
        dateStrings !== false &&
        !(Array.isArray(dateStrings) && dateStrings.every((type) => type === 'DATE'))
    ) {
        throw OptionsError.timezoneConflict('mysql dateStrings would hand DATETIME or TIMESTAMP values over as zone-less strings.');
    }

    if (typeof readSetting(options, 'typeCast') !== 'undefined') {
        throw OptionsError.timezoneConflict('a custom mysql typeCast decides how date values are read.');
    }

    const driver = options.driver ?? PlatformTools.load('mysql2');
    const extra = { ...(options.extra ?? {}) };
    delete extra.timezone;
    delete extra.dateStrings;

    return {
        ...options,
        extra,
        timezone: 'Z',
        dateStrings: ['DATE'],
        driver: createMysqlUTCDriver(driver),
    };
}
