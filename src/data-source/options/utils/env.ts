import type { DataSourceOptions } from 'typeorm';
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import type { LoggerOptions } from 'typeorm/logger/LoggerOptions';
import { useEnv } from '../../../env';
import { OptionsError } from '../../../errors';
import { mergeDataSourceOptions } from './merge';
import { isDataSourceTimezone, withDataSourceTimezone } from '../timezone';

export function hasEnvDataSourceOptions() : boolean {
    return !!useEnv('type');
}

/**
 * Apply `DB_TIMEZONE`, when set, once the options are complete: applied
 * before a merge, a deep merge would reach into the wrapped driver module.
 */
function applyEnvTimezone(options: DataSourceOptions) : DataSourceOptions {
    const timezone = useEnv('timezone');
    if (typeof timezone === 'undefined' || timezone === '') {
        return options;
    }

    if (!isDataSourceTimezone(timezone)) {
        throw OptionsError.timezoneUnsupported(timezone);
    }

    return withDataSourceTimezone(options, 'UTC');
}

export function readDataSourceOptionsFromEnv() : DataSourceOptions | undefined {
    const options = readRawDataSourceOptionsFromEnv();
    if (!options) {
        return undefined;
    }

    return applyEnvTimezone(options);
}

/* istanbul ignore next */
function readRawDataSourceOptionsFromEnv() : DataSourceOptions | undefined {
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
            uuidExtension: useEnv('uuidExtension') as PostgresDataSourceOptions['uuidExtension'],
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
    const env = readRawDataSourceOptionsFromEnv();
    if (!env) {
        return applyEnvTimezone(options);
    }

    return applyEnvTimezone(mergeDataSourceOptions(env, options));
}
