import process from 'node:process';
import type { DataSourceCacheOption } from '../data-source';
import { hasOwnProperty } from '../utils';
import { EnvironmentVariableName } from './constants';

export function hasProcessEnv(key: string | string[]) : boolean {
    const keys = Array.isArray(key) ? key : [key];
    for (let i = 0; i < keys.length; i++) {
        if (hasOwnProperty(process.env, keys[i])) {
            return true;
        }
    }
    return false;
}

export function readFromProcessEnv(key: string | string[]) : string | undefined;
export function readFromProcessEnv<T>(key: string | string[], alt: T) : T | string;
export function readFromProcessEnv<T>(key: string | string[], alt?: T): any {
    const keys = Array.isArray(key) ? key : [key];
    for (let i = 0; i < keys.length; i++) {
        if (hasOwnProperty(process.env, keys[i])) {
            return process.env[keys[i]];
        }
    }

    return alt;
}

export function readIntFromProcessEnv(
    key: string | string[],
    alt?: number,
): number | undefined {
    const keys = Array.isArray(key) ? key : [key];

    for (let i = 0; i < keys.length; i++) {
        const value = readFromProcessEnv(keys[i], alt);
        const intValue = parseInt(`${value}`, 10);

        if (!Number.isNaN(intValue)) {
            return intValue;
        }
    }

    return alt;
}

function extractBooleanFromString(input?: string | boolean) : boolean | undefined {
    switch (input) {
        case true:
        case 'true':
        case 't':
        case '1':
            return true;
        case false:
        case 'false':
        case 'f':
        case '0':
            return false;
    }

    return undefined;
}

export function readBoolFromProcessEnv(key: string | string[], alt?: boolean): boolean | undefined {
    const keys = Array.isArray(key) ? key : [key];
    for (let i = 0; i < keys.length; i++) {
        const value = extractBooleanFromString(readFromProcessEnv(keys[i], alt));
        if (typeof value === 'boolean') {
            return value;
        }
    }

    return alt;
}

export function transformStringToArray(input?: string) : string[] {
    if (!input) {
        return [];
    }

    return input.split(',').map((el) => el.trim());
}

export function transformLogging(input?: string) : boolean | string | string[] {
    const value = extractBooleanFromString(input);
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 'all') {
        return 'all';
    }

    return transformStringToArray(value);
}

export function transformCache(input?: string) : DataSourceCacheOption | undefined {
    const value = extractBooleanFromString(input);
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
        if (hasProcessEnv([EnvironmentVariableName.CACHE_OPTIONS, EnvironmentVariableName.CACHE_OPTIONS_ALT])) {
            const temp = readFromProcessEnv([EnvironmentVariableName.CACHE_OPTIONS, EnvironmentVariableName.CACHE_OPTIONS_ALT]);
            if (temp) {
                options = JSON.parse(temp);
            }
        }
        return {
            type: input,
            options,
            alwaysEnabled: readBoolFromProcessEnv([
                EnvironmentVariableName.CACHE_ALWAYS_ENABLED,
                EnvironmentVariableName.CACHE_ALWAYS_ENABLED_ALT,
            ]),
            duration: readIntFromProcessEnv([
                EnvironmentVariableName.CACHE_DURATION,
                EnvironmentVariableName.CACHE_DURATION_ALT,
            ]),
        };
    }

    return undefined;
}
