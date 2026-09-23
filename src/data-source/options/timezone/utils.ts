import type { DataSourceTimezone } from './type';

export function isDataSourceTimezone(input: unknown) : input is DataSourceTimezone {
    return typeof input === 'string' && input.toUpperCase() === 'UTC';
}

export function isDate(input: unknown) : input is Date {
    return input instanceof Date ||
        Object.prototype.toString.call(input) === '[object Date]';
}

/**
 * Everything this module installs (wrapped drivers, clients, parsers,
 * session callbacks) is recorded here, so a second application recognises
 * the first one exactly instead of guessing from option values.
 */
const installed = new WeakSet<object>();

export function markInstalled<T extends object>(value: T) : T {
    installed.add(value);
    return value;
}

export function isInstalled(value: unknown) : boolean {
    return (typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        installed.has(value);
}

/**
 * Whether the options carry a pin applied earlier, in any of the places a
 * dialect installs one.
 */
export function hasInstalledTimezone(options: { driver?: unknown, extra?: unknown }) : boolean {
    if (isInstalled(options.driver)) {
        return true;
    }

    const extra = options.extra && typeof options.extra === 'object' ?
        options.extra as Record<string, unknown> :
        {};

    return isInstalled(extra.types) ||
        isInstalled(extra.Client) ||
        isInstalled(extra.sessionCallback);
}
