import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import path from 'path';

export const options: DataSourceOptions = {
    type: 'better-sqlite3',
    database: path.join(path.dirname(fileURLToPath(import.meta.url)), 'db.sqlite'),
};

export default new DataSource(options);
