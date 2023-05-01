import type { DataSourceOptions } from 'typeorm';
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import type { LoggerOptions } from 'typeorm/logger/LoggerOptions';
import { useEnv } from '../../../env';
import { mergeDataSourceOptions } from './merge';

export function hasEnvDataSourceOptions() : boolean {
    return !!useEnv('type');
}

/* istanbul ignore next */
export function readDataSourceOptionsFromEnv() : DataSourceOptions | undefined {
    if (!hasEnvDataSourceOptions()) {
        return undefined;
    }

    // todo: include seeder options
    const base : Omit<BaseDataSourceOptions, 'poolSize'> = {
        type: useEnv('type') as DatabaseType,
        entities: useEnv('entities'),
        subscribers: useEnv('subscribers'),
        migrations: useEnv('migrations'),
        migrationsTableName: useEnv('migrationsTableName'),
        // migrationsTransactionMode: useEnv('migra')
        metadataTableName: useEnv('metadataTableName'),
        logging: useEnv('logging') as LoggerOptions,
        logger: useEnv('logger') as BaseDataSourceOptions['logger'],
        maxQueryExecutionTime: useEnv('maxQueryExecutionTime'),
        synchronize: useEnv('synchronize'),
        migrationsRun: useEnv('migrationsRun'),
        dropSchema: useEnv('schemaDrop'),
        entityPrefix: useEnv('entityPrefix'),
        extra: useEnv('extra'),
        cache: useEnv('cache'),
    };

    const credentialOptions = {
        url: useEnv('url'),
        host: useEnv('host'),
        port: useEnv('port'),
        username: useEnv('username'),
        password: useEnv('password'),
        database: useEnv('database'),
    };

    if (base.type === 'mysql' || base.type === 'mariadb') {
        return {
            ...base,
            ...credentialOptions,
            type: base.type,
        };
    }

    if (base.type === 'postgres') {
        return {
            ...base,
            ...credentialOptions,
            type: base.type,
            schema: useEnv('schema'),
            uuidExtension: useEnv('uuidExtension') as PostgresConnectionOptions['uuidExtension'],
        };
    }

    if (base.type === 'cockroachdb') {
        return {
            ...base,
            ...credentialOptions,
            type: base.type,
            schema: useEnv('schema'),
            timeTravelQueries: true,
        };
    }

    if (base.type === 'sqlite') {
        return {
            ...base,
            type: base.type,
            database: useEnv('database') || 'db.sqlite',
        };
    }

    if (base.type === 'better-sqlite3') {
        return {
            ...base,
            type: base.type,
            database: useEnv('database') || 'db.sqlite',
        };
    }

    if (base.type === 'mssql') {
        return {
            ...base,
            ...credentialOptions,
            type: base.type,
            schema: useEnv('schema'),
        };
    }

    if (base.type === 'oracle') {
        return {
            ...base,
            ...credentialOptions,
            type: base.type,
            sid: useEnv('sid'),
        };
    }

    return {
        ...base,
        ...credentialOptions,
    } as DataSourceOptions;
}

export function mergeDataSourceOptionsWithEnv(options: DataSourceOptions) {
    const env = readDataSourceOptionsFromEnv();
    if (!env) {
        return options;
    }

    return mergeDataSourceOptions(env, options);
}
