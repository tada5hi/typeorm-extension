import {
    read,
    readBool,
    readInt,
    toArray,
    toBool,
} from 'envix';
import type { DataSourceCacheOption } from '../data-source';
import { EnvironmentVariableName } from './constants';

export function transformLogging(input?: string) : boolean | string | string[] | undefined {
    if (typeof input === 'undefined') {
        return undefined;
    }

    const value = toBool(input);

    if (typeof value === 'boolean') {
        return value;
    }

    if (input === 'all') {
        return 'all';
    }

    return toArray(input) ?? [];
}

export function transformCache(input?: string) : DataSourceCacheOption | undefined {
    const value = toBool(input);

    if (typeof value === 'boolean') {
        return value;
    }

    if (
        input === 'redis' ||
        input === 'ioredis' ||
        input === 'database' ||
        input === 'ioredis/cluster'
    ) {
        let options : Record<string, any> | undefined;
        const envCacheOptions = read([
            EnvironmentVariableName.CACHE_OPTIONS,
            EnvironmentVariableName.CACHE_OPTIONS_ALT,
        ]);

        if (envCacheOptions) {
            options = JSON.parse(envCacheOptions);
        }

        return {
            type: input,
            options,
            alwaysEnabled: readBool([
                EnvironmentVariableName.CACHE_ALWAYS_ENABLED,
                EnvironmentVariableName.CACHE_ALWAYS_ENABLED_ALT,
            ]),
            duration: readInt([
                EnvironmentVariableName.CACHE_DURATION,
                EnvironmentVariableName.CACHE_DURATION_ALT,
            ], { strict: true }),
        };
    }

    return undefined;
}
