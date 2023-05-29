import path from 'node:path';
import {
    buildDataSourceOptions,
} from '../../../src';
import { checkTestDatabase, destroyTestDatabase } from '../../data/typeorm/utils';

describe('src/database/module.ts', () => {
    const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');

    it('should build simple connection options', async () => {
        const options = await buildDataSourceOptions({
            directory: rootPath,
        });

        expect(options).toBeDefined();
    });

    it('should check database', async () => {
        const check = await checkTestDatabase();

        expect(check).toBeDefined();
        // special case, only for sqlite/file driver
        expect(check.exists).toBeTruthy();

        await destroyTestDatabase();
    });
});
