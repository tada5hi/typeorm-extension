import type { MysqlDataSourceOptions } from 'typeorm/driver/mysql/MysqlDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import { OptionsError } from '../../../errors';
import type { MysqlModule } from './type';
import { isInstalled, markInstalled } from './utils';

const MYSQL_SESSION_TIMEZONE_SQL = 'SET time_zone = \'+00:00\'';

/**
 * The mysql2 `timezone` values meaning UTC.
 */
const MYSQL_UTC_TIMEZONE = /^(?:z|[+-]00:00)$/i;

/**
 * Wrap a `mysql2` module so every pool pins its connections to UTC. The pool
 * emits `connection` synchronously, before it hands a new connection out, and
 * a connection runs its queries in order, so the `SET` is the first statement
 * every connection executes. A connection whose `SET` fails is destroyed
 * rather than left running in another zone.
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
    });
}

function readSetting<K extends string>(options: Record<string, any>, key: K) : unknown {
    // typeorm merges `extra` over the options it passes to mysql2
    const extra = options.extra ?? {};
    return typeof extra[key] !== 'undefined' ? extra[key] : options[key];
}

/**
 * Pin a mysql / mariadb data source: the session runs `SET time_zone` on
 * every new pool connection, and mysql2 reads and writes DATETIME and
 * TIMESTAMP values as UTC (`timezone: 'Z'`). DATE values are returned as
 * strings (`dateStrings: ['DATE']`): a calendar date has no instant, and
 * mysql2 would otherwise hand it over as UTC midnight, which typeorm then
 * formats back in the process zone, a day early west of UTC.
 *
 * A `timezone` naming UTC and `dateStrings: ['DATE']` are accepted as they
 * are. Another `timezone`, other `dateStrings`, a custom `typeCast` or a
 * replication setup (a pool cluster has no per-connection hook) is a
 * conflict.
 */
export function applyMysqlTimezone(options: MysqlDataSourceOptions) : MysqlDataSourceOptions {
    if (isInstalled(options.driver)) {
        return options;
    }

    if (typeof options.replication !== 'undefined') {
        throw OptionsError.timezoneConflict('a mysql replication setup has no per-connection hook to pin the session with.');
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
