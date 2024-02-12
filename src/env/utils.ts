import {
    oneOf, read, readBool, readInt, toArray, toBool,
} from 'envix';
import type { DataSourceCacheOption } from '../data-source';
import { EnvironmentVariableName } from './constants';

export function transformLogging(input?: string) : boolean | string | string[] {
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
        const envCacheOptions = oneOf([
            read(EnvironmentVariableName.CACHE_OPTIONS),
            read(EnvironmentVariableName.CACHE_OPTIONS_ALT),
        ]);
        if (envCacheOptions) {
            options = JSON.parse(envCacheOptions);
        }

        return {
            type: input,
            options,
            alwaysEnabled: oneOf([
                readBool(EnvironmentVariableName.CACHE_ALWAYS_ENABLED),
                readBool(EnvironmentVariableName.CACHE_ALWAYS_ENABLED_ALT),
            ]),
            duration: oneOf([
                readInt(EnvironmentVariableName.CACHE_DURATION),
                readInt(EnvironmentVariableName.CACHE_DURATION_ALT),
            ]),
        };
    }

    return undefined;
}
