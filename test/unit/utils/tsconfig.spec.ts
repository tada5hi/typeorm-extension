import {readTsConfig} from "../../../src/utils/tsconfig";
import path from "path";

describe('src/utils/tsconfig.ts', () => {
    it('should read tsconfig file', async () => {
        const rootPath : string = path.resolve(__dirname, '..', '..', 'data');
        const tsConfig = await readTsConfig(rootPath);

        expect(tsConfig.compilerOptions).toBeDefined();
        if(tsConfig.compilerOptions) {
            expect(tsConfig.compilerOptions.outDir).toEqual('output');
        }
    });

    it('should read empty tsconfig', async () => {
        const rootPath : string = path.resolve(__dirname, '..', '..', 'data', 'foo');
        const tsConfig = await readTsConfig(rootPath);

        expect(tsConfig).toBeDefined();
        expect(tsConfig).toEqual({});
    })
})
