import { InstanceChecker } from 'typeorm';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDataSource, findDataSourceOptions } from '../../../src';

describe('src/data-source/utils/find.ts', () => {
    it('should find and load data-source', async () => {
        let dataSource = await findDataSource({ directory: path.join(import.meta.dirname, '..', '..', 'data', 'typeorm') });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));

        expect(dataSource?.options.extra).toEqual({ charset: 'UTF8_GENERAL_CI' });

        dataSource = await findDataSource({ directory: 'test/data/typeorm' });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should fall back to the src directory when there is no build', async () => {
        const tsconfig = { compilerOptions: { outDir: 'dist' } };

        let dataSource = await findDataSource({
            directory: path.join(import.meta.dirname, '..', '..', 'data', 'source-only', 'src'),
            tsconfig,
        });

        expect(dataSource?.options.extra).toEqual({ sourceOnly: true });

        dataSource = await findDataSource({ directory: 'test/data/source-only/src', tsconfig });

        expect(dataSource?.options.extra).toEqual({ sourceOnly: true });
    });

    it('should find and load async data-source', async () => {
        const dataSource = await findDataSource({
            directory: path.join(import.meta.dirname, '..', '..', 'data', 'typeorm'),
            fileName: 'data-source-async',
        });

        expect(InstanceChecker.isDataSource(dataSource)).toBe(true);
        expect(dataSource?.options.extra).toEqual({ marker: 'async' });
    });

    it('should find data-source with windows separator', async () => {
        const dataSource = await findDataSource({ directory: 'test\\data\\typeorm' });

        expect(dataSource).toBeDefined();
        expect(InstanceChecker.isDataSource(dataSource));
    });

    it('should find data-source with default export', async () => {
        let dataSource = await findDataSource({
            fileName: 'data-source-default',
            directory: path.join(import.meta.dirname, '..', '..', 'data', 'typeorm'),
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

    describe('export shapes', () => {
        const directory = path.join(import.meta.dirname, '..', '..', 'data', 'typeorm', 'find');

        async function findMarker(fileName: string) {
            const dataSource = await findDataSource({ directory, fileName });

            expect(InstanceChecker.isDataSource(dataSource)).toBe(true);

            return dataSource?.options.extra?.marker;
        }

        it('should wrap exported data-source options', async () => {
            await expect(findMarker('options')).resolves.toEqual('options');
        });

        it('should call a sync factory default export', async () => {
            await expect(findMarker('factory-sync')).resolves.toEqual('factory-sync');
        });

        it('should prefer a data-source export over a factory and options', async () => {
            await expect(findMarker('precedence-data-source')).resolves.toEqual('data-source');
        });

        it('should prefer a factory export over options', async () => {
            await expect(findMarker('precedence-factory')).resolves.toEqual('factory');
        });

        it('should not call a named function export', async () => {
            await expect(findMarker('named-function')).resolves.toEqual('options');
        });

        it('should not call a default export function with parameters', async () => {
            await expect(findMarker('default-parameter')).resolves.toEqual('fallback');
        });

        it('should not call a default export class', async () => {
            await expect(findMarker('default-class')).resolves.toEqual('fallback');
        });

        it('should call a default export whose parameters all have defaults', async () => {
            await expect(findMarker('default-optional')).resolves.toEqual('default-optional');
        });

        it('should return exported options without constructing a data source', async () => {
            const options = await findDataSourceOptions({ directory, fileName: 'options-missing-driver' });

            expect(options?.type).toEqual('sap');
            expect(options?.extra?.marker).toEqual('missing-driver');
        });

        it('should return the options of an exported data source', async () => {
            const options = await findDataSourceOptions({ directory, fileName: 'precedence-data-source' });

            expect(options?.extra?.marker).toEqual('data-source');
        });

        it('should skip classes, functions with parameters and other values', async () => {
            await expect(findMarker('no-shape')).resolves.toEqual('fallback');
        });
    });
});
