import path from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';

export const options: DataSourceOptions = {
    type: 'better-sqlite3',
    database: path.join(import.meta.dirname, 'db.sqlite'),
};

export default new DataSource(options);
