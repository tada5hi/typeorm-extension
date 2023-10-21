import { InstanceChecker } from 'typeorm';
import path from 'path';
import { findDataSource } from '../../../src';

describe('src/data-source/utils/find.ts', () => {
    it('should find and load data-source', async () => {
        let dataSource = await findDataSource({
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm'),
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
        if (dataSource) {
            expect(dataSource.options.extra).toBeDefined();
        }

        dataSource = await findDataSource({
            directory: 'test/data/typeorm',
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should find and load async data-source', async () => {
        const dataSource = await findDataSource({
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm'),
            fileName: 'data-source-async',
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should find data-source with windows separator', async () => {
        const dataSource = await findDataSource({
            directory: 'test\\data\\typeorm',
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should find data-source with default export', async () => {
        let dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: path.join(__dirname, '..', '..', 'data', 'typeorm'),
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
        if (dataSource) {
            expect(dataSource.options.extra).toBeUndefined();
        }

        dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: 'test/data/typeorm',
        });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });
});
