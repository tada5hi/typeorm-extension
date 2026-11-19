import type { DataSourceOptions } from 'typeorm';

export function createMarkedOptions(marker: string) : DataSourceOptions {
    return {
        type: 'better-sqlite3',
        database: ':memory:',
        extra: { marker },
    };
}
