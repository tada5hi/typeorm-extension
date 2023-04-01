import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import { EnvironmentName, EnvironmentVariableName } from './constants';
import type { Environment } from './type';
import {
    hasProcessEnv,
    readBoolFromProcessEnv,
    readFromProcessEnv,
    readIntFromProcessEnv,
    transformCache,
    transformLogging,
    transformStringToArray,
} from './utils';

let instance : Environment | undefined;

export function useEnv() : Environment;
export function useEnv<K extends keyof Environment>(key: K) : Environment[K];
export function useEnv(key?: string) : any {
    if (typeof instance !== 'undefined') {
        if (typeof key === 'string') {
            return instance[key as keyof Environment];
        }

        return instance;
    }

    const output: Environment = {
        env: readFromProcessEnv(EnvironmentVariableName.ENV, EnvironmentName.DEVELOPMENT) as `${EnvironmentName}`,

        // Seeder
        seeds: transformStringToArray(readFromProcessEnv([
            EnvironmentVariableName.SEEDS,
            EnvironmentVariableName.SEEDS_ALT,
        ])),
        factories: transformStringToArray(readFromProcessEnv([
            EnvironmentVariableName.FACTORIES,
            EnvironmentVariableName.FACTORIES_ALT,
        ])),

        // Database
        url: readFromProcessEnv([
            EnvironmentVariableName.URL,
            EnvironmentVariableName.URL_ALT,
        ]),
        host: readFromProcessEnv([
            EnvironmentVariableName.HOST,
            EnvironmentVariableName.HOST_ALT,
        ]),
        port: readIntFromProcessEnv([
            EnvironmentVariableName.PORT,
            EnvironmentVariableName.PORT_ALT,
        ]),
        username: readFromProcessEnv([
            EnvironmentVariableName.USERNAME,
            EnvironmentVariableName.USERNAME_ALT,
        ]),
        password: readFromProcessEnv([
            EnvironmentVariableName.PASSWORD,
            EnvironmentVariableName.PASSWORD_ALT,
        ]),
        database: readFromProcessEnv([
            EnvironmentVariableName.DATABASE,
            EnvironmentVariableName.DATABASE_ALT,
        ]),
        sid: readFromProcessEnv([
            EnvironmentVariableName.SID,
            EnvironmentVariableName.SID_ALT,
        ]),
        schema: readFromProcessEnv([
            EnvironmentVariableName.SCHEMA,
            EnvironmentVariableName.SCHEMA_ALT,
        ]),
        extra: readFromProcessEnv([
            EnvironmentVariableName.DRIVER_EXTRA,
            EnvironmentVariableName.DRIVER_EXTRA_ALT,
        ]),
        synchronize: readBoolFromProcessEnv([
            EnvironmentVariableName.SYNCHRONIZE,
            EnvironmentVariableName.SYNCHRONIZE_ALT,
        ]),
        schemaDrop: readBoolFromProcessEnv([
            EnvironmentVariableName.SCHEMA_DROP,
            EnvironmentVariableName.SCHEMA_DROP_ALT,
        ]),
        migrationsRun: readBoolFromProcessEnv([
            EnvironmentVariableName.MIGRATIONS_RUN,
            EnvironmentVariableName.MIGRATIONS_RUN_ALT,
        ]),
        entities: transformStringToArray(readFromProcessEnv([
            EnvironmentVariableName.ENTITIES,
            EnvironmentVariableName.ENTITIES_ALT,
        ])),
        migrations: transformStringToArray(readFromProcessEnv([
            EnvironmentVariableName.MIGRATIONS,
            EnvironmentVariableName.MIGRATIONS_ALT,
        ])),
        migrationsTableName: readFromProcessEnv([
            EnvironmentVariableName.MIGRATIONS_TABLE_NAME,
            EnvironmentVariableName.MIGRATIONS_TABLE_NAME_ALT,
        ]),
        metadataTableName: readFromProcessEnv([
            EnvironmentVariableName.METADATA_TABLE_NAME,
            EnvironmentVariableName.METADATA_TABLE_NAME_ALT,
        ]),
        subscribers: transformStringToArray(readFromProcessEnv([
            EnvironmentVariableName.SUBSCRIBERS,
            EnvironmentVariableName.SUBSCRIBERS_ALT,
        ])),
        logging: transformLogging(readFromProcessEnv([
            EnvironmentVariableName.LOGGING,
            EnvironmentVariableName.LOGGING_ALT,
        ])),
        logger: readFromProcessEnv([
            EnvironmentVariableName.LOGGER,
            EnvironmentVariableName.LOGGER_ALT,
        ]),
        entityPrefix: readFromProcessEnv([
            EnvironmentVariableName.ENTITY_PREFIX,
            EnvironmentVariableName.ENTITY_PREFIX_ALT,
        ]),
        maxQueryExecutionTime: readIntFromProcessEnv([
            EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME,
            EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME_ALT,
        ]),
        debug: readFromProcessEnv([
            EnvironmentVariableName.DEBUG,
            EnvironmentVariableName.DEBUG_ALT,
        ]),
        cache: transformCache(readFromProcessEnv([
            EnvironmentVariableName.CACHE,
            EnvironmentVariableName.CACHE_ALT,
        ])),
        uuidExtension: readFromProcessEnv([
            EnvironmentVariableName.UUID_EXTENSION,
            EnvironmentVariableName.UUID_EXTENSION_ALT,
        ]),

    };

    if (output.extra) {
        output.extra = JSON.parse(output.extra); // todo: ensure record<string,any> ??
    }

    let type : string | undefined;
    if (hasProcessEnv([EnvironmentVariableName.TYPE, EnvironmentVariableName.TYPE_ALT])) {
        type = readFromProcessEnv([EnvironmentVariableName.TYPE, EnvironmentVariableName.TYPE_ALT]);
    } else if (hasProcessEnv([EnvironmentVariableName.URL, EnvironmentVariableName.URL_ALT])) {
        const temp = readFromProcessEnv([EnvironmentVariableName.URL, EnvironmentVariableName.URL_ALT]);
        if (temp) {
            const parts = temp.split('://');
            if (parts.length > 0) {
                // eslint-disable-next-line prefer-destructuring
                type = parts[0];
            }
        }
    }
    if (type) {
        output.type = type as DatabaseType; // todo: maybe validation here
    }

    instance = output;

    if (typeof key === 'string') {
        return output[key as keyof Environment];
    }

    return instance;
}

export function resetEnv() {
    if (typeof instance !== 'undefined') {
        instance = undefined;
    }
}
