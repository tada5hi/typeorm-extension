import {
    describe, expect, it,
} from 'vitest';
import path from 'node:path';
import {
    buildDataSourceOptions, checkDatabase, createDatabase,
} from '../../../src';

describe('src/database/module.ts', () => {
    const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');

    it('should build simple connection options', async () => {
        const options = await buildDataSourceOptions({
            directory: rootPath,
        });

        expect(options).toBeDefined();
    });

    it.only('should check database', async () => {
        const options = await buildDataSourceOptions({
            directory: rootPath,
        });

        console.log(options);

        expect(options).toBeDefined();

        await createDatabase({ ifNotExist: true, options });

        const check = await checkDatabase({
            options,
        });

        expect(check).toBeDefined();
        expect(check.exists).toBeTruthy();
    });
});
