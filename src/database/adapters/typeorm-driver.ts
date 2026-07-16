import type { DataSource, DataSourceOptions } from 'typeorm';
import { DriverFactory } from 'typeorm/driver/DriverFactory';

const driversRequireDatabaseOption: DataSourceOptions['type'][] = [
    'better-sqlite3',
];

/**
 * Acquire the native client handle (driver.postgres, driver.mysql, ...)
 * via TypeORM's DriverFactory, so typeorm stays the single source of
 * client libraries. The DataSource is never initialized.
 */
export function useNativeDriver(options: DataSourceOptions) {
    const fakeConnection: DataSource = {
        options: {
            type: options.type,
            ...(driversRequireDatabaseOption.includes(options.type) ? { database: options.database } : {}),
        },
    } as DataSource;

    return new DriverFactory().create(fakeConnection);
}
