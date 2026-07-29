import { SchemaDriftError, assertSchemaMatchesMetadata, getSchemaDrift } from '../../../../src';
import { createDataSource, createDataSourceOptions } from '../../../data/typeorm/factory';

describe('src/database/schema/drift', () => {
    it('should detect drift for a schema which does not exist yet', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            const drift = await getSchemaDrift(dataSource);

            expect(drift.exists).toBeTruthy();
            expect(drift.up.length).toBeGreaterThan(0);
            expect(drift.up.some((statement) => /CREATE TABLE/i.test(statement.query))).toBeTruthy();
        } finally {
            await dataSource.destroy();
        }
    });

    it('should not detect drift for a synchronized schema', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            await dataSource.synchronize();

            const drift = await getSchemaDrift(dataSource);

            expect(drift.exists).toBeFalsy();
            expect(drift.up).toEqual([]);
            expect(drift.down).toEqual([]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('should detect drift from data source options', async () => {
        const drift = await getSchemaDrift(createDataSourceOptions());

        expect(drift.exists).toBeTruthy();
    });

    it('should skip a data source without migrations', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            const drift = await getSchemaDrift(dataSource, { skipWithoutMigrations: true });

            expect(drift.exists).toBeFalsy();
            expect(drift.up).toEqual([]);
        } finally {
            await dataSource.destroy();
        }
    });

    it('should throw on drift', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            expect.assertions(3);

            await assertSchemaMatchesMetadata(dataSource);
        } catch (e) {
            expect(e).toBeInstanceOf(SchemaDriftError);
            expect((e as SchemaDriftError).statements.length).toBeGreaterThan(0);
            expect((e as SchemaDriftError).message).toContain('CREATE TABLE');
        } finally {
            await dataSource.destroy();
        }
    });

    it('should not throw for a synchronized schema', async () => {
        const dataSource = createDataSource();
        await dataSource.initialize();

        try {
            await dataSource.synchronize();

            await expect(assertSchemaMatchesMetadata(dataSource)).resolves.toBeUndefined();
        } finally {
            await dataSource.destroy();
        }
    });
});
