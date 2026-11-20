import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';
import { readTSConfig } from '../../../src/utils/tsconfig';

describe('src/utils/tsconfig.ts', () => {
    it('should read tsconfig file', async () => {
        const rootPath : string = path.resolve(import.meta.dirname, '..', '..', 'data');
        const tsConfig = await readTSConfig(rootPath);

        expect(tsConfig.compilerOptions).toBeDefined();

        if (tsConfig.compilerOptions) {
            expect(tsConfig.compilerOptions.outDir).toEqual('output');
        }
    });

    it('should read empty tsconfig', async () => {
        const rootPath : string = path.resolve(import.meta.dirname, '..', '..', 'data', 'foo');
        const tsConfig = await readTSConfig(rootPath);

        expect(tsConfig).toBeDefined();
        expect(tsConfig).toEqual({});
    });

    it('should follow a relative extends without extension, with comments and trailing commas', async () => {
        const rootPath = path.resolve(import.meta.dirname, '..', '..', 'data', 'tsconfig-extends');
        const tsConfig = await readTSConfig(rootPath);

        // get-tsconfig normalizes values (lowercase target) and adds implied options (strict family).
        expect(tsConfig.compilerOptions).toMatchObject({
            outDir: 'build',
            rootDir: 'src',
            target: 'es2022',
            strict: true,
        });
    });
});

describe('src/utils/tsconfig.ts (extends)', () => {
    let tmp: string;

    const write = async (file: string, content: unknown) => {
        const filePath = path.join(tmp, file);

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(
            filePath,
            typeof content === 'string' ? content : JSON.stringify(content),
        );
    };

    beforeEach(async () => {
        tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tsconfig-extends-'));
    });

    afterEach(async () => {
        await fs.promises.rm(tmp, { recursive: true, force: true });
    });

    it('should keep comment and comma characters inside strings', async () => {
        await write('tsconfig.json', '{ "compilerOptions": { "outDir": "out//a/*b*/,", "jsx": "preserve" }, }');

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ outDir: 'out//a/*b*/,', jsx: 'preserve' });
    });

    it('should let the child override the parent', async () => {
        await write('base.json', { compilerOptions: { outDir: 'base-out', target: 'ES2020' } });
        await write('tsconfig.json', { extends: './base.json', compilerOptions: { outDir: 'out' } });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ outDir: 'out', target: 'es2020' });
    });

    it('should follow extends recursively and rebase on every level', async () => {
        await write('a/b/root.json', { compilerOptions: { outDir: 'dist-root' } });
        await write('a/middle.json', { extends: './b/root.json', compilerOptions: { target: 'ES2022' } });
        await write('tsconfig.json', { extends: './a/middle.json' });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ outDir: 'a/b/dist-root', target: 'es2022' });
    });

    it('should rebase a parent outDir pointing above the parent directory', async () => {
        await write('config/base.json', { compilerOptions: { outDir: '../build' } });
        await write('packages/app/tsconfig.json', { extends: '../../config/base.json' });

        const tsConfig = await readTSConfig(path.join(tmp, 'packages', 'app'));

        expect(tsConfig.compilerOptions?.outDir).toEqual('../../build');
    });

    it('should apply an extends array in order', async () => {
        await write('one.json', { compilerOptions: { outDir: 'one', target: 'ES2020' } });
        await write('two.json', { compilerOptions: { outDir: 'two' } });
        await write('tsconfig.json', { extends: ['./one.json', './two.json'] });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ outDir: 'two', target: 'es2020' });
    });

    it('should resolve a package subpath specifier', async () => {
        await write('node_modules/@scope/base/tsconfig.json', { compilerOptions: { target: 'ES2022' } });
        await write('tsconfig.json', { extends: '@scope/base/tsconfig.json', compilerOptions: { outDir: 'out' } });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ outDir: 'out', target: 'es2022' });
    });

    it('should resolve a package subpath without extension from a parent directory', async () => {
        await write('node_modules/base/node22.json', { compilerOptions: { target: 'ES2023' } });
        await write('packages/app/tsconfig.json', { extends: 'base/node22' });

        const tsConfig = await readTSConfig(path.join(tmp, 'packages', 'app'));

        expect(tsConfig.compilerOptions).toMatchObject({ target: 'es2023' });
    });

    it('should resolve a package by its tsconfig field or its root tsconfig.json', async () => {
        await write('node_modules/with-field/package.json', { name: 'with-field', tsconfig: './config/base.json' });
        await write('node_modules/with-field/config/base.json', { compilerOptions: { target: 'ES2021' } });
        await write('node_modules/with-root/package.json', { name: 'with-root' });
        await write('node_modules/with-root/tsconfig.json', { compilerOptions: { module: 'NodeNext' } });
        await write('tsconfig.json', { extends: ['with-field', 'with-root'] });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions).toMatchObject({ target: 'es2021', module: 'nodenext' });
    });

    it('should resolve a package subpath through package.json exports', async () => {
        await write('node_modules/with-exports/package.json', {
            name: 'with-exports',
            exports: { './base': './configs/base.json' },
        });
        await write('node_modules/with-exports/configs/base.json', { compilerOptions: { outDir: '../../../lib' } });
        await write('tsconfig.json', { extends: 'with-exports/base' });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions?.outDir).toEqual('lib');
    });

    it('should read the file alone when a parent is missing', async () => {
        await write('missing.json', { extends: './missing-parent.json', compilerOptions: { outDir: 'out' } });
        await write('tsconfig.json', { extends: '@tsconfig/missing/tsconfig.json', compilerOptions: { outDir: 'build' } });

        expect((await readTSConfig(path.join(tmp, 'missing.json'))).compilerOptions?.outDir).toEqual('out');
        expect(await readTSConfig(tmp)).toEqual({
            extends: '@tsconfig/missing/tsconfig.json',
            compilerOptions: { outDir: 'build' },
        });
    });

    it('should ignore an unparsable parent', async () => {
        await write('broken.json', '{ not json');
        await write('tsconfig.json', { extends: './broken.json', compilerOptions: { outDir: 'out' } });

        // get-tsconfig parses leniently: an unparsable parent contributes nothing.
        expect((await readTSConfig(tmp)).compilerOptions?.outDir).toEqual('out');
    });

    it('should read the file alone on cyclic extends', async () => {
        await write('a.json', { extends: './tsconfig.json', compilerOptions: { outDir: 'a-out' } });
        await write('tsconfig.json', { extends: './a.json', compilerOptions: { outDir: 'out' } });

        expect(await readTSConfig(tmp)).toEqual({
            extends: './a.json',
            compilerOptions: { outDir: 'out' },
        });
    });

    it('should fall back to an empty object when the file alone is not plain json either', async () => {
        await write('tsconfig.json', '{ "extends": "./missing.json", // comment\n "compilerOptions": {} }');

        expect(await readTSConfig(tmp)).toEqual({});
    });

    it('should keep an absolute outDir inherited from a parent', async () => {
        const absolute = path.join(tmp, 'abs-out');

        await write('config/base.json', { compilerOptions: { outDir: absolute, rootDir: '../src' } });
        await write('mid.json', { extends: './config/base.json' });
        await write('tsconfig.json', { extends: ['./mid.json'] });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions?.outDir).toEqual(absolute);
        expect(tsConfig.compilerOptions?.rootDir).toEqual('src');
    });

    it('should keep an absolute outDir inherited from a package parent', async () => {
        const absolute = path.join(tmp, 'abs-out');

        await write('node_modules/abs-base/package.json', {
            name: 'abs-base',
            exports: { './base': './configs/base.json' },
        });
        await write('node_modules/abs-base/configs/base.json', { compilerOptions: { outDir: absolute } });
        await write('config/mid.json', { extends: 'abs-base/base' });
        await write('tsconfig.json', { extends: ['./config/mid'] });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions?.outDir).toEqual(absolute);
    });

    it('should keep an absolute outDir inherited through a require-only exports entry', async () => {
        const absolute = path.join(tmp, 'require-out');

        await write('node_modules/require-base/package.json', {
            name: 'require-base',
            exports: { './base': { require: './configs/base.json' } },
        });
        await write('node_modules/require-base/configs/base.json', { compilerOptions: { outDir: absolute } });
        await write('tsconfig.json', { extends: 'require-base/base' });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions?.outDir).toEqual(absolute);
    });

    it('should not take an absolute outDir from a parent the child overrides', async () => {
        await write('base.json', { compilerOptions: { outDir: path.join(tmp, 'abs-out') } });
        await write('tsconfig.json', { extends: './base.json', compilerOptions: { outDir: 'out' } });

        expect((await readTSConfig(tmp)).compilerOptions?.outDir).toEqual('out');
    });

    it('should keep an absolute outDir of the file read', async () => {
        const absolute = path.join(tmp, 'abs-out');

        await write('tsconfig.json', { compilerOptions: { outDir: absolute } });

        const tsConfig = await readTSConfig(tmp);

        expect(tsConfig.compilerOptions?.outDir).toEqual(absolute);
    });
});
