import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import path from 'path';

export const options: DataSourceOptions = {
    type: 'better-sqlite3',
    database: path.join(__dirname, 'db.sqlite'),
};

export default new DataSource(options);
