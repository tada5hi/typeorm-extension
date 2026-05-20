import type { DataSource, DataSourceOptions } from 'typeorm';
import { DriverFactory } from 'typeorm/driver/DriverFactory';

const driversRequireDatabaseOption: DataSourceOptions['type'][] = [
    'better-sqlite3',
];

export function createDriver(connectionOptions: DataSourceOptions) {
    const fakeConnection: DataSource = {
        options: {
            type: connectionOptions.type,
            ...(driversRequireDatabaseOption.includes(connectionOptions.type) ? { database: connectionOptions.database } : {}),
        },
    } as DataSource;

    const driverFactory = new DriverFactory();
    return driverFactory.create(fakeConnection);
}
