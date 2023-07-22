import path from 'node:path';
import { readTSConfig } from '../../../src/utils/tsconfig';

describe('src/utils/tsconfig.ts', () => {
    it('should read tsconfig file', async () => {
        const rootPath : string = path.resolve(__dirname, '..', '..', 'data');
        const tsConfig = await readTSConfig(rootPath);

        expect(tsConfig.compilerOptions).toBeDefined();
        if (tsConfig.compilerOptions) {
            expect(tsConfig.compilerOptions.outDir).toEqual('output');
        }
    });

    it('should read empty tsconfig', async () => {
        const rootPath : string = path.resolve(__dirname, '..', '..', 'data', 'foo');
        const tsConfig = await readTSConfig(rootPath);

        expect(tsConfig).toBeDefined();
        expect(tsConfig).toEqual({});
    });
});
