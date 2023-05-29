import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import path from 'node:path';
import { User } from '../entity/user';
import type { SeederOptions } from '../../../src';

export const options : DataSourceOptions & SeederOptions = {
    type: 'better-sqlite3',
    entities: [User],
    database: path.join(__dirname, 'db.sqlite'),
    factories: ['test/data/factory/**/*.{ts,.js}'],
    seeds: ['test/data/seed/**/*.{ts,js}'],
    extra: {
        charset: 'UTF8_GENERAL_CI',
    },
};

export const dataSource = new DataSource(options);
