import {
    read,
    readBool,
    readInt,
} from 'envix';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import { useRuntimeRegistry } from '../runtime';
import { EnvironmentName, EnvironmentVariableName } from './constants';
import { readEnvList } from './list';
import type { Environment } from './types';
import {
    transformCache,
    transformLogging,
} from './utils';

export function useEnv() : Environment;
export function useEnv<K extends keyof Environment>(key: K) : Environment[K];
export function useEnv(key?: string) : any {
    const registry = useRuntimeRegistry();

    if (typeof registry.env !== 'undefined') {
        if (typeof key === 'string') {
            return registry.env[key as keyof Environment];
        }

        return registry.env;
    }

    const output: Environment = {
        env: read(EnvironmentVariableName.ENV, { default: EnvironmentName.DEVELOPMENT }) as `${EnvironmentName}`,

        // Seeder
        seeds: readEnvList([
            EnvironmentVariableName.SEEDS,
            EnvironmentVariableName.SEEDS_ALT,
        ]) ?? [],
        factories: readEnvList([
            EnvironmentVariableName.FACTORIES,
            EnvironmentVariableName.FACTORIES_ALT,
        ]) ?? [],

        // Database
        url: read([
            EnvironmentVariableName.URL,
            EnvironmentVariableName.URL_ALT,
        ]),
        host: read([
            EnvironmentVariableName.HOST,
            EnvironmentVariableName.HOST_ALT,
        ]),
        port: readInt([
            EnvironmentVariableName.PORT,
            EnvironmentVariableName.PORT_ALT,
        ]),
        username: read([
            EnvironmentVariableName.USERNAME,
            EnvironmentVariableName.USERNAME_ALT,
        ]),
        password: read([
            EnvironmentVariableName.PASSWORD,
            EnvironmentVariableName.PASSWORD_ALT,
        ]),
        database: read([
            EnvironmentVariableName.DATABASE,
            EnvironmentVariableName.DATABASE_ALT,
        ]),
        sid: read([
            EnvironmentVariableName.SID,
            EnvironmentVariableName.SID_ALT,
        ]),
        schema: read([
            EnvironmentVariableName.SCHEMA,
            EnvironmentVariableName.SCHEMA_ALT,
        ]),
        extra: read([
            EnvironmentVariableName.DRIVER_EXTRA,
            EnvironmentVariableName.DRIVER_EXTRA_ALT,
        ]),
        synchronize: readBool([
            EnvironmentVariableName.SYNCHRONIZE,
            EnvironmentVariableName.SYNCHRONIZE_ALT,
        ]),
        schemaDrop: readBool([
            EnvironmentVariableName.SCHEMA_DROP,
            EnvironmentVariableName.SCHEMA_DROP_ALT,
        ]),
        migrationsRun: readBool([
            EnvironmentVariableName.MIGRATIONS_RUN,
            EnvironmentVariableName.MIGRATIONS_RUN_ALT,
        ]),
        entities: readEnvList([
            EnvironmentVariableName.ENTITIES,
            EnvironmentVariableName.ENTITIES_ALT,
        ]) ?? [],
        migrations: readEnvList([
            EnvironmentVariableName.MIGRATIONS,
            EnvironmentVariableName.MIGRATIONS_ALT,
        ]) ?? [],
        migrationsTableName: read([
            EnvironmentVariableName.MIGRATIONS_TABLE_NAME,
            EnvironmentVariableName.MIGRATIONS_TABLE_NAME_ALT,
        ]),
        metadataTableName: read([
            EnvironmentVariableName.METADATA_TABLE_NAME,
            EnvironmentVariableName.METADATA_TABLE_NAME_ALT,
        ]),
        subscribers: readEnvList([
            EnvironmentVariableName.SUBSCRIBERS,
            EnvironmentVariableName.SUBSCRIBERS_ALT,
        ]) ?? [],
        logging: transformLogging(read([
            EnvironmentVariableName.LOGGING,
            EnvironmentVariableName.LOGGING_ALT,
        ])),
        logger: read([
            EnvironmentVariableName.LOGGER,
            EnvironmentVariableName.LOGGER_ALT,
        ]),
        entityPrefix: read([
            EnvironmentVariableName.ENTITY_PREFIX,
            EnvironmentVariableName.ENTITY_PREFIX_ALT,
        ]),
        maxQueryExecutionTime: readInt([
            EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME,
            EnvironmentVariableName.MAX_QUERY_EXECUTION_TIME_ALT,
        ]),
        debug: read([
            EnvironmentVariableName.DEBUG,
            EnvironmentVariableName.DEBUG_ALT,
        ]),
        cache: transformCache(read([
            EnvironmentVariableName.CACHE,
            EnvironmentVariableName.CACHE_ALT,
        ])),
        uuidExtension: read([
            EnvironmentVariableName.UUID_EXTENSION,
            EnvironmentVariableName.UUID_EXTENSION_ALT,
        ]),
        pinTimezone: read([
            EnvironmentVariableName.PIN_TIMEZONE,
            EnvironmentVariableName.PIN_TIMEZONE_ALT,
        ]),

    };

    if (output.extra) {
        output.extra = JSON.parse(output.extra); // todo: ensure record<string,any> ??
    }

    let type : string | undefined;
    const envType = read([
        EnvironmentVariableName.TYPE,
        EnvironmentVariableName.TYPE_ALT,
    ]);

    if (envType) {
        type = envType;
    } else {
        const envURL = read([
            EnvironmentVariableName.URL,
            EnvironmentVariableName.URL_ALT,
        ]);

        // Only a scheme names the driver: without one, the whole url would
        // become the type.
        const schemeEnd = envURL ? envURL.indexOf('://') : -1;

        if (envURL && schemeEnd > 0) {
            type = envURL.slice(0, schemeEnd);
        }
    }

    if (type) {
        output.type = type as DatabaseType; // todo: maybe validation here
    }

    registry.env = output;

    if (typeof key === 'string') {
        return output[key as keyof Environment];
    }

    return output;
}

export function resetEnv() {
    useRuntimeRegistry().env = undefined;
}
