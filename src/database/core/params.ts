import type { DataSourceOptions } from 'typeorm';
import { DriverUtils } from 'typeorm/driver/DriverUtils';
import type { ConnectionParams } from './type';

function readStringOption(options: DataSourceOptions, key: string): string | undefined {
    const record = options as Record<string, any>;

    if (typeof record[key] === 'string') {
        return record[key];
    }

    if (typeof record.extra?.[key] === 'string') {
        return record.extra[key];
    }

    return undefined;
}

export function buildConnectionParams(options: DataSourceOptions): ConnectionParams {
    let driverOptions: Record<string, any>;

    switch (options.type) {
        case 'mysql':
        case 'mariadb':
        case 'postgres':
        case 'cockroachdb':
        case 'mssql':
        case 'oracle':
            driverOptions = DriverUtils.buildDriverOptions(options.replication ? options.replication.master : options);
            break;
        case 'mongodb':
            driverOptions = DriverUtils.buildMongoDBDriverOptions(options);
            break;
        default:
            driverOptions = DriverUtils.buildDriverOptions(options);
    }

    const charset = readStringOption(options, 'charset');
    const characterSet = readStringOption(options, 'characterSet');

    return {
        host: driverOptions.host,
        user: driverOptions.user || driverOptions.username,
        password: driverOptions.password,
        database: driverOptions.database,
        port: driverOptions.port,
        ...(charset ? { charset } : {}),
        ...(characterSet ? { characterSet } : {}),
        ...(driverOptions.ssl ? { ssl: driverOptions.ssl } : {}),
        ...(driverOptions.url ? { url: driverOptions.url } : {}),
        ...(driverOptions.connectString ? { connectString: driverOptions.connectString } : {}),
        ...(driverOptions.sid ? { sid: driverOptions.sid } : {}),
        ...(driverOptions.serviceName ? { serviceName: driverOptions.serviceName } : {}),
        ...(driverOptions.template ? { template: driverOptions.template } : {}),
        ...(options.extra ? { extra: options.extra } : {}),
        ...(driverOptions.domain ? { domain: driverOptions.domain } : {}),
        ...(driverOptions.schema ? { schema: driverOptions.schema } : {}),
    };
}
