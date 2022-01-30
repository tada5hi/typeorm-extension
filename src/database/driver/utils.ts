/* istanbul ignore next */
import { Connection, ConnectionOptions } from 'typeorm';
import { DriverUtils } from 'typeorm/driver/DriverUtils';
import { DriverFactory } from 'typeorm/driver/DriverFactory';
import { DriverConnectionOptions } from '../../connection';

export function buildDriverConnectionOptions(connectionOptions: ConnectionOptions): DriverConnectionOptions {
    let driverOptions: Record<string, any> = {};

    switch (connectionOptions.type) {
        case 'mysql':
        case 'mariadb':
        case 'postgres':
        case 'cockroachdb':
        case 'mssql':
        case 'oracle':
            driverOptions = DriverUtils.buildDriverOptions(connectionOptions.replication ? connectionOptions.replication.master : connectionOptions);
            break;
        case 'mongodb':
            driverOptions = DriverUtils.buildMongoDBDriverOptions(connectionOptions);
            break;
        default:
            driverOptions = DriverUtils.buildDriverOptions(connectionOptions);
    }

    return {
        host: driverOptions.host,
        user: driverOptions.user || driverOptions.username,
        password: driverOptions.password,
        database: driverOptions.database,
        port: driverOptions.port,
        ...(driverOptions.ssl ? { ssl: driverOptions.ssl } : {}),
        ...(driverOptions.url ? { url: driverOptions.url } : {}),
        ...(connectionOptions.extra ? connectionOptions.extra : {}),
    };
}

const driversRequireDatabaseOption: ConnectionOptions['type'][] = [
    'sqlite',
    'better-sqlite3',
];

export function createDriver(connectionOptions: ConnectionOptions) {
    const fakeConnection: Connection = {
        options: {
            type: connectionOptions.type,
            ...(driversRequireDatabaseOption.indexOf(connectionOptions.type) !== -1 ? {
                database: connectionOptions.database,
            } : {}),
        },
    } as Connection;

    const driverFactory = new DriverFactory();
    return driverFactory.create(fakeConnection);
}
