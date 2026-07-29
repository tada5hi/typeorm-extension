import { synchronizeDatabaseSchema } from '../../../../src';
import { createDataSource, createDataSourceOptions } from '../../../data/typeorm/factory';

describe('src/database/schema/synchronize', () => {
    it('should synchronize the schema of a data source instance', async () => {
        const dataSource = createDataSource();

        try {
            const migrations = await synchronizeDatabaseSchema(dataSource);

            expect(migrations).toEqual([]);
            expect(dataSource.isInitialized).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should synchronize the schema from data source options', async () => {
        const migrations = await synchronizeDatabaseSchema(createDataSourceOptions());

        expect(migrations).toEqual([]);
    });
});
