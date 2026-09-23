import type { MysqlDataSourceOptions } from 'typeorm/driver/mysql/MysqlDataSourceOptions';
import { PlatformTools } from 'typeorm/platform/PlatformTools';
import type { MysqlModule } from './type';

const MYSQL_SESSION_TIMEZONE_SQL = 'SET time_zone = \'+00:00\'';

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
 * Pin a mysql / mariadb data source: `timezone: 'Z'` for mysql2 (reading and
 * parameters), and pools that run `SET time_zone = '+00:00'` on every new
 * connection. A `timezone` already set, or a replication setup (a pool
 * cluster has no per-connection hook), returns the options unchanged.
 */
export function applyMysqlTimezone(options: MysqlDataSourceOptions) : MysqlDataSourceOptions {
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
