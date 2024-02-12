import {
    oneOf, read, readArray, readBool, readInt,
} from 'envix';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import { EnvironmentName, EnvironmentVariableName } from './constants';
import type { Environment } from './type';
import {
    transformCache,
    transformLogging,
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
        env: read(EnvironmentVariableName.ENV, EnvironmentName.DEVELOPMENT) as `${EnvironmentName}`,

        // Seeder
        seeds: oneOf([
            readArray(EnvironmentVariableName.SEEDS),
            readArray(EnvironmentVariableName.SEEDS_ALT),
        ]) ?? [],
        factories: oneOf([
            readArray(EnvironmentVariableName.FACTORIES),
            readArray(EnvironmentVariableName.FACTORIES_ALT),
        ]) ?? [],

        // Database
        url: oneOf([
            read(EnvironmentVariableName.URL),
            read(EnvironmentVariableName.URL_ALT),
        ]),
        host: oneOf([
            read(EnvironmentVariableName.HOST),
            read(EnvironmentVariableName.HOST_ALT),
        ]),
        port: oneOf([
            readInt(EnvironmentVariableName.PORT),
            readInt(EnvironmentVariableName.PORT_ALT),
        ]),
        username: oneOf([
            read(EnvironmentVariableName.USERNAME),
            read(EnvironmentVariableName.USERNAME_ALT),
        ]),
        password: oneOf([
            read(EnvironmentVariableName.PASSWORD),
            read(EnvironmentVariableName.PASSWORD_ALT),
        ]),
        database: oneOf([
            read(EnvironmentVariableName.DATABASE),
            read(EnvironmentVariableName.DATABASE_ALT),
        ]),
        sid: oneOf([
            read(EnvironmentVariableName.SID),
            read(EnvironmentVariableName.SID_ALT),
        ]),
        schema: oneOf([
            read(EnvironmentVariableName.SCHEMA),
            read(EnvironmentVariableName.SCHEMA_ALT),
        ]),
        extra: oneOf([
            read(EnvironmentVariableName.DRIVER_EXTRA),
            read(EnvironmentVariableName.DRIVER_EXTRA_ALT),
        ]),
        synchronize: oneOf([
            readBool(EnvironmentVariableName.SYNCHRONIZE),
            readBool(EnvironmentVariableName.SYNCHRONIZE_ALT),
        ]),
        schemaDrop: oneOf([
            readBool(EnvironmentVariableName.SCHEMA_DROP),
            readBool(EnvironmentVariableName.SCHEMA_DROP_ALT),
        ]),
        migrationsRun: oneOf([
            readBool(EnvironmentVariableName.MIGRATIONS_RUN),
            readBool(EnvironmentVariableName.MIGRATIONS_RUN_ALT),
        ]),
        entities: oneOf([
            readArray(EnvironmentVariableName.ENTITIES),
            readArray(EnvironmentVariableName.ENTITIES_ALT),
        ]) ?? [],
        migrations: oneOf([
            readArray(EnvironmentVariableName.MIGRATIONS),
            readArray(EnvironmentVariableName.MIGRATIONS_ALT),
        ]) ?? [],
        migrationsTableName: oneOf([
            read(EnvironmentVariableName.MIGRATIONS_TABLE_NAME),
            read(EnvironmentVariableName.MIGRATIONS_TABLE_NAME_ALT),
        ]),
        metadataTableName: oneOf([
            read(EnvironmentVariableName.METADATA_TABLE_NAME),
            read(EnvironmentVariableName.METADATA_TABLE_NAME_ALT),
        ]),
        subscribers: oneOf([
            readArray(EnvironmentVariableName.SUBSCRIBERS),
            readArray(EnvironmentVariableName.SUBSCRIBERS_ALT),
        ]) ?? [],
        logging: transformLogging(oneOf([
            read(EnvironmentVariableName.LOGGING),
            read(EnvironmentVariableName.LOGGING_ALT),
        ])),
        logger: oneOf([
            read(EnvironmentVariableName.LOGGER),
            read(EnvironmentVariableName.LOGGER_ALT),
        ]),
        entityPrefix: oneOf([
            read(EnvironmentVariableName.ENTITY_PREFIX),
            read(EnvironmentVariableName.ENTITY_PREFIX_ALT),
        ]),
        maxQueryExecutionTime: oneOf([
            readInt(EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME),
            readInt(EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME_ALT),
        ]),
        debug: oneOf([
            read(EnvironmentVariableName.DEBUG),
            read(EnvironmentVariableName.DEBUG_ALT),
        ]),
        cache: transformCache(oneOf([
            read(EnvironmentVariableName.CACHE),
            read(EnvironmentVariableName.CACHE_ALT),
        ])),
        uuidExtension: oneOf([
            read(EnvironmentVariableName.UUID_EXTENSION),
            read(EnvironmentVariableName.UUID_EXTENSION_ALT),
        ]),

    };

    if (output.extra) {
        output.extra = JSON.parse(output.extra); // todo: ensure record<string,any> ??
    }

    let type : string | undefined;
    const envType = oneOf([
        read(EnvironmentVariableName.TYPE),
        read(EnvironmentVariableName.TYPE_ALT),
    ]);
    const envURL = oneOf([
        read(EnvironmentVariableName.URL),
        read(EnvironmentVariableName.URL_ALT),
    ]);
    if (envType) {
        type = envType;
    } else if (envURL) {
        const temp = envURL;
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
