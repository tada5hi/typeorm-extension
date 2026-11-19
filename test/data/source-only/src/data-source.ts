import { DataSource } from 'typeorm';

// A project without a build: there is no dist/ next to this src/ directory.
export const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    extra: { sourceOnly: true },
});
