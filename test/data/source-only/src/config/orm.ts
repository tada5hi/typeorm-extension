import { DataSource } from 'typeorm';

// Referenced without extension: -d src/config/orm
export const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    extra: { sourceOnly: 'orm' },
});
