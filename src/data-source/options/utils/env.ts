import type { DataSourceOptions } from 'typeorm';
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import type { LoggerOptions } from 'typeorm/logger/LoggerOptions';
import { useEnv } from '../../../env';
import { OptionsError } from '../../../errors';
import { mergeDataSourceOptions } from './merge';
import { pinTimezone } from '../timezone';
import { hasInstalledTimezone, isDataSourceTimezone } from '../timezone/utils';

/**
 * True when the environment names a driver: DB_TYPE (or TYPEORM_CONNECTION),
 * or a DB_URL whose scheme names it.
 */
export function hasEnvDataSourceOptions() : boolean {
    return !!useEnv('type');
}

/**
 * True when the environment names a connection: DB_URL, DB_HOST, DB_PORT,
 * DB_USERNAME, DB_PASSWORD, DB_DATABASE or DB_SID (or a TYPEORM_* alias).
 *
 * Together with hasEnvDataSourceOptions() it finds an environment which
 * names a connection but no driver, e.g. to refuse it instead of falling
 * back to a default driver. An empty value counts as unset, as an empty
 * DB_TYPE does. It checks the values data source options are built from
 * (useEnv()), so it always agrees with what buildDataSourceOptions() reads.
 */
export function hasEnvDataSourceConnectionOptions() : boolean {
    const env = useEnv();

    return [
        env.url,
        env.host,
        env.port,
        env.username,
        env.password,
        env.database,
        env.sid,
    ].some((value) => typeof value !== 'undefined' && value !== '');
}

/**
 * Apply `DB_PIN_TIMEZONE`, when set, once the options are complete: applied
 * before a merge, a deep merge would reach into the wrapped driver module.
 * Options pinned in code are re-checked after the merge as well, so an
 * environment value undoing part of the pin (a `DB_DRIVER_EXTRA`
 * timezone, say)
 * fails instead of leaving it half applied.
 */
function applyEnvTimezone(options: DataSourceOptions) : DataSourceOptions {
    const timezone = useEnv('pinTimezone');

    if (typeof timezone === 'undefined' || timezone === '') {
        return hasInstalledTimezone(options) ?
            pinTimezone(options, 'UTC') :
            options;
    }

    if (!isDataSourceTimezone(timezone)) {
        throw OptionsError.timezoneUnsupported(timezone);
    }

    return pinTimezone(options, 'UTC');
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
