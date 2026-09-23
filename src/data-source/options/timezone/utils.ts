import type { DataSourceTimezone } from './type';

export function isDataSourceTimezone(input: unknown) : input is DataSourceTimezone {
    return typeof input === 'string' && input.toUpperCase() === 'UTC';
}

export function isDate(input: unknown) : input is Date {
    return input instanceof Date ||
        Object.prototype.toString.call(input) === '[object Date]';
}
