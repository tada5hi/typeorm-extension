import type { DataSource, DataSourceOptions } from 'typeorm';
import { DriverFactory } from 'typeorm/driver/DriverFactory';

const driversRequireDatabaseOption: DataSourceOptions['type'][] = [
    'sqlite',
    'better-sqlite3',
];

export function createDriver(connectionOptions: DataSourceOptions) {
    const fakeConnection: DataSource = {
        options: {
            type: connectionOptions.type,
            ...(driversRequireDatabaseOption.indexOf(connectionOptions.type) !== -1 ? {
                database: connectionOptions.database,
            } : {}),
        },
    } as DataSource;

    const driverFactory = new DriverFactory();
    return driverFactory.create(fakeConnection);
}
