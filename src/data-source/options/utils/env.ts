import type { DataSourceOptions } from 'typeorm';
import type { BaseDataSourceOptions } from 'typeorm/data-source/BaseDataSourceOptions';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';
import type { DatabaseType } from 'typeorm/driver/types/DatabaseType';
import type { LoggerOptions } from 'typeorm/logger/LoggerOptions';
import { EnvironmentVariableName, useEnv } from '../../../env';
import { OptionsError } from '../../../errors';
import { mergeDataSourceOptions } from './merge';
import { pinTimezone } from '../timezone';
import { hasInstalledTimezone, isDataSourceTimezone } from '../timezone/utils';

type EnvDataSourceOptionsInspection = {
    /**
     * DB_TYPE (or TYPEORM_CONNECTION), or a DB_URL whose scheme names it.
     */
    driver: boolean,
    /**
     * The connection settings which are set, by their DB_* name (the
     * TYPEORM_* alias may be the one set).
     */
    connection: string[],
};

const CONNECTION_VARIABLES = [
    ['url', EnvironmentVariableName.URL],
    ['host', EnvironmentVariableName.HOST],
    ['port', EnvironmentVariableName.PORT],
    ['username', EnvironmentVariableName.USERNAME],
    ['password', EnvironmentVariableName.PASSWORD],
    ['database', EnvironmentVariableName.DATABASE],
    ['sid', EnvironmentVariableName.SID],
] as const;

/**
 * The one place for the rules of the env checks. It reads the values data
 * source options are built from (useEnv()), so it always agrees with what
 * buildDataSourceOptions() reads. An empty value counts as unset, as an
 * empty DB_TYPE does.
 *
 * Internal: this file is part of the public barrel, so it is not exported.
 */
function inspectEnvDataSourceOptions() : EnvDataSourceOptionsInspection {
    const env = useEnv();

    return {
        driver: !!env.type,
        connection: CONNECTION_VARIABLES
            .filter(([key]) => typeof env[key] !== 'undefined' && env[key] !== '')
            .map(([, name]) => name),
    };
}

/**
 * True when the environment names a driver: DB_TYPE (or TYPEORM_CONNECTION),
 * or a DB_URL whose scheme names it.
 *
 * With `strict`, it is only true when the environment describes a data
 * source completely: a driver and at least one connection setting (DB_URL,
 * DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE or DB_SID, or a
 * TYPEORM_* alias).
 *
 * An incomplete environment gives false, never an error:
 * assertEnvDataSourceOptions() tells why it is refused. A malformed
 * DB_DRIVER_EXTRA still fails, as everywhere the environment is read.
 */
export function hasEnvDataSourceOptions(options: { strict?: boolean } = {}) : boolean {
    const inspection = inspectEnvDataSourceOptions();

    if (options.strict) {
        return inspection.driver && inspection.connection.length > 0;
    }

    return inspection.driver;
}

/**
 * Refuse an environment which names connection settings (DB_URL, DB_HOST,
 * DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_SID, or a TYPEORM_*
 * alias) but no driver (DB_TYPE): data source options are not read from it,
 * so the settings would be ignored without a word.
 *
 * With `required`, an environment which names no driver at all is refused
 * as well, e.g. to require the database configuration in production.
 *
 * @throws OptionsError naming the variables involved.
 */
export function assertEnvDataSourceOptions(options: { required?: boolean } = {}) : void {
    const inspection = inspectEnvDataSourceOptions();

    if (inspection.driver) {
        return;
    }

    if (inspection.connection.length > 0) {
        throw OptionsError.envDriverMissing(inspection.connection);
    }

    if (options.required) {
        throw OptionsError.envMissing();
    }
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

/**
 * Fill the driver defaults the environment implies, once the options are
 * complete. Applied before a merge, a default would win over the value of
 * the data source file.
 */
function applyEnvDefaults(options: DataSourceOptions) : DataSourceOptions {
    if (
        options.type === 'better-sqlite3' &&
        (typeof options.database === 'undefined' || options.database === '')
    ) {
        return { ...options, database: 'db.sqlite' };
    }

    if (
        options.type === 'cockroachdb' &&
        typeof options.timeTravelQueries === 'undefined'
    ) {
        return { ...options, timeTravelQueries: true };
    }

    return options;
}

export function readDataSourceOptionsFromEnv() : DataSourceOptions | undefined {
    const options = readRawDataSourceOptionsFromEnv();

    if (!options) {
        return undefined;
    }

    return applyEnvTimezone(applyEnvDefaults(options));
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
            // timeTravelQueries is left to the file, applyEnvDefaults() fills it.
        } as DataSourceOptions;
    }

    if (base.type === 'better-sqlite3') {
        return {
            ...base,
            type: base.type,
            // An empty value counts as unset, applyEnvDefaults() fills it.
            database: useEnv('database') || undefined,
        } as DataSourceOptions;
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

    return applyEnvTimezone(applyEnvDefaults(mergeDataSourceOptions(env, options)));
}
