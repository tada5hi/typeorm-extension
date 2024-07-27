import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import type { SeederOptions } from '../../../src';
import { Role } from '../entity/role';
import { User } from '../entity/user';

export function createDataSourceOptions() : DataSourceOptions & SeederOptions {
    return {
        type: 'better-sqlite3',
        entities: [Role, User],
        database: ':memory:',
        factories: ['test/data/factory/**/*.{ts,.js}'],
        seeds: ['test/data/seed/**/*.{ts,js}'],
        extra: {
            charset: 'UTF8_GENERAL_CI',
        },
    };
}

export function createDataSource(options?: DataSourceOptions) : DataSource {
    return new DataSource(options || createDataSourceOptions());
}
