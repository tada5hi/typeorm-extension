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
import { createPathResolver } from '../../../src';
import type { PathResolverOptions } from '../../../src';

describe('src/utils/path-resolver (fallback on miss)', () => {
    let root: string;

    const touch = async (file: string) => {
        const filePath = path.join(root, file);

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, '');
    };

    const create = (options: PathResolverOptions = {}) => createPathResolver({
        root,
        tsconfig: { compilerOptions: { outDir: 'dist' } },
        typescript: true,
        ...options,
    });

    beforeEach(async () => {
        root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'path-resolver-'));
    });

    afterEach(async () => {
        await fs.promises.rm(root, { recursive: true, force: true });
    });

    it('should use the build path when it exists', async () => {
        await touch('src/data-source.ts');
        await touch('dist/data-source.js');

        expect(await create().transform('src/data-source.ts')).toEqual('dist/data-source.js');
    });

    it('should fall back to the source path when the build path is missing', async () => {
        await touch('src/data-source.ts');

        const resolver = create();

        expect(await resolver.transform('src/data-source.ts')).toEqual('src/data-source.ts');
        expect(await resolver.resolve('src/data-source.ts')).toEqual(path.join(root, 'src', 'data-source.ts'));
    });

    it('should keep the build path when neither path exists', async () => {
        expect(await create().transform('src/data-source.ts')).toEqual('dist/data-source.js');
    });

    it('should not fall back to a typescript file the runtime can not load', async () => {
        await touch('src/data-source.ts');
        await touch('src/seed.js');

        const resolver = create({ typescript: false });

        expect(await resolver.transform('src/data-source.ts')).toEqual('dist/data-source.js');
        expect(await resolver.transform('src/seed.js')).toEqual('src/seed.js');
    });

    it('should fall back for glob patterns which match only below the source path', async () => {
        await touch('src/entities/user.ts');

        const resolver = create();

        expect(await resolver.transform('src/entities/*.ts')).toEqual('src/entities/*.ts');
        expect(await resolver.transform('src/entities/*.{ts,js}')).toEqual('src/entities/*.{ts,js}');
        expect(await resolver.transform('src/migrations/*.ts')).toEqual('dist/migrations/*.js');
    });

    it('should use the build glob when it matches', async () => {
        await touch('src/entities/user.ts');
        await touch('dist/entities/user.js');

        expect(await create().transform('src/entities/*.ts')).toEqual('dist/entities/*.js');
    });

    it('should only fall back to a glob matching a file the runtime can load', async () => {
        await touch('src/entities/user.ts');

        const resolver = create({ typescript: false });

        expect(await resolver.transform('src/entities/*.{ts,js}')).toEqual('dist/entities/*.{ts,js}');
    });

    it('should not fall back to a glob which also matches a file the runtime can not load', async () => {
        await touch('src/entities/user.ts');
        await touch('src/entities/role.js');

        expect(await create({ typescript: false }).transform('src/entities/*.{ts,js}')).toEqual('dist/entities/*.{ts,js}');
        expect(await create({ typescript: false }).transform('src/entities/*.js')).toEqual('src/entities/*.js');
        expect(await create({ typescript: true }).transform('src/entities/*.{ts,js}')).toEqual('src/entities/*.{ts,js}');
    });

    it('should fall back for absolute paths and directories', async () => {
        await touch('src/database/data-source.ts');

        const resolver = create();
        const directory = path.join(root, 'src', 'database');

        expect(await resolver.transform(directory)).toEqual(directory);
    });

    it('should fall back in transformKeys', async () => {
        await touch('src/seeds/user.ts');

        const output = await create().transformKeys({
            seeds: ['src/seeds/*.ts', 'src/missing/*.ts'],
            seedName: 'src/seeds/user.ts',
        });

        expect(output).toEqual({
            seeds: ['src/seeds/*.ts', 'dist/missing/*.js'],
            seedName: 'src/seeds/user.ts',
        });
    });

    it('should never fall back in transform mode', async () => {
        await touch('src/data-source.ts');

        expect(await create({ mode: 'transform' }).transform('src/data-source.ts')).toEqual('dist/data-source.js');
    });

    it('should never rewrite in preserve mode', async () => {
        await touch('dist/data-source.js');

        expect(await create({ mode: 'preserve' }).transform('src/data-source.ts')).toEqual('src/data-source.ts');
    });

    describe('resolveDirectory', () => {
        const pattern = 'orm.{js,ts}';

        it('should pick the build directory when the pattern matches there', async () => {
            await touch('src/config/orm.ts');
            await touch('dist/config/orm.js');

            expect(await create().resolveDirectory(path.join(root, 'src', 'config'), pattern))
                .toEqual(path.join(root, 'dist', 'config'));
        });

        it('should pick the source directory when the build directory lacks the file', async () => {
            await touch('src/config/orm.ts');
            await fs.promises.mkdir(path.join(root, 'dist', 'config'), { recursive: true });

            expect(await create().resolveDirectory(path.join(root, 'src', 'config'), pattern))
                .toEqual(path.join(root, 'src', 'config'));
        });

        it('should keep the build directory when the source file can not be loaded or is missing', async () => {
            await touch('src/config/orm.ts');

            const directory = path.join(root, 'src', 'config');

            expect(await create({ typescript: false }).resolveDirectory(directory, pattern))
                .toEqual(path.join(root, 'dist', 'config'));
            expect(await create().resolveDirectory(directory, 'missing.{js,ts}'))
                .toEqual(path.join(root, 'dist', 'config'));
        });

        it('should handle a directory containing glob characters', async () => {
            await touch('app (x86) [old]/src/orm.ts');

            const directory = path.join(root, 'app (x86) [old]', 'src');

            expect(await create().resolveDirectory(directory, pattern)).toEqual(directory);
        });

        it('should follow the preserve and transform modes', async () => {
            await touch('src/config/orm.ts');

            const directory = path.join(root, 'src', 'config');

            expect(await create({ mode: 'preserve' }).resolveDirectory(directory, pattern)).toEqual(directory);
            expect(await create({ mode: 'transform' }).resolveDirectory(directory, pattern))
                .toEqual(path.join(root, 'dist', 'config'));
        });

        it('should keep a directory without a src segment', async () => {
            await touch('lib/orm.ts');

            const directory = path.join(root, 'lib');

            expect(await create().resolveDirectory(directory, pattern)).toEqual(directory);
        });
    });
});
