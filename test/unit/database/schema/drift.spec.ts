import { describe, expect, it } from 'vitest';
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

    it('should not initialize a data source which would mutate the schema', async () => {
        const dataSource = createDataSource({
            ...createDataSourceOptions(),
            synchronize: true,
            dropSchema: true,
        } as any);

        try {
            const drift = await getSchemaDrift(dataSource);

            // initializing it would have synchronized (and dropped) the schema,
            // so the inspection has to happen through an own instance
            expect(dataSource.isInitialized).toBeFalsy();
            expect(drift.exists).toBeTruthy();
        } finally {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
            }
        }
    });

    it('should initialize a data source which does not mutate the schema', async () => {
        const dataSource = createDataSource();

        try {
            const drift = await getSchemaDrift(dataSource);

            expect(dataSource.isInitialized).toBeTruthy();
            expect(drift.exists).toBeTruthy();
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
