import {ConnectionOptions} from "typeorm";
import {DriverUtils} from "typeorm/driver/DriverUtils";
import {SimpleConnectionOptions} from "./options";

export function buildSimpleConnectionOptions(connectionOptions: ConnectionOptions) : SimpleConnectionOptions {
    let driverOptions : Record<string, any> = {};

    switch (connectionOptions.type) {
        case "mysql" :
        case "mariadb" :
        case "postgres":
        case "cockroachdb":
        case "mssql":
        case "oracle":
            driverOptions =  DriverUtils.buildDriverOptions(connectionOptions.replication ? connectionOptions.replication.master : connectionOptions);
            break;
        case "mongodb":
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
        ssl: driverOptions.ssl,
        url: driverOptions.url
    }
}
