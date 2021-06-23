import {ConnectionOptions} from "typeorm";
import {DriverUtils} from "typeorm/driver/DriverUtils";
import {SimpleConnectionOptions} from "./options";
import {ConnectionWithSeederOptions} from "../seeder";
import {hasOwnProperty, isTsNodeRuntimeEnvironment} from "../utils";
import path from "path";

/* istanbul ignore next */
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

type CompilerOptions = {
    srcDirectory?: string,
    distDirectory?: string,
}

export function modifyConnectionOptionForRuntimeEnvironment<T extends Record<string, any>>(
    options: T,
    key: keyof ConnectionWithSeederOptions,
    compilerOptions?: CompilerOptions
): T {
    if (!hasOwnProperty(options, key)) {
        return options;
    }

    compilerOptions = compilerOptions ?? {};

    let value = options[key];

    switch (key) {
        case "entities":
        case "subscribers":
        case "seeds":
        case "factories":
            const isTsNodeEnv = isTsNodeRuntimeEnvironment();
            if (!isTsNodeEnv) {
                let srcDir: string = 'src';
                if (typeof compilerOptions.srcDirectory === 'string') {
                    srcDir = compilerOptions.srcDirectory.split(path.sep)[0];
                }

                let outDir: string = 'dist';
                if (typeof compilerOptions.distDirectory === 'string') {
                    outDir = compilerOptions.distDirectory;
                }

                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i++) {
                        const str = value[i];
                        // won't happen in ts env
                        /* istanbul ignore next */
                        if (typeof str !== 'string') {
                            continue;
                        }

                        value[i] = str
                            .replace(srcDir, outDir)
                            .replace('.ts', '.js');
                    }
                } else {
                    if (typeof value === 'string') {
                        value = value.replace(srcDir, outDir)
                            .replace('.ts', '.js')
                    }
                }
            }
            break;
    }

    return {
        ...options,
        [key]: value
    };
}

export function modifyConnectionOptionsForRuntimeEnvironment<T extends Record<string, any>>(
    connectionOptions: T,
    compilerOptions?: CompilerOptions
) : T {
    const keys: Extract<keyof ConnectionWithSeederOptions, 'entities' | 'subscribers' | 'seeds' | 'factories'>[] = [
        'entities',
        'subscribers',
        'seeds',
        'factories'
    ];

    for (let i = 0; i < keys.length; i++) {
        connectionOptions = modifyConnectionOptionForRuntimeEnvironment(
            connectionOptions,
            keys[i],
            compilerOptions
        );
    }

    return connectionOptions;
}
