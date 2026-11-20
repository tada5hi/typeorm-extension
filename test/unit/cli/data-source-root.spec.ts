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
import { buildCLIDataSourceContext } from '../../../src/cli/data-source';
import { buildDataSourceOptions } from '../../../src';

// The process cwd (the repository) differs from --root (a temp project).
describe('src/cli/data-source (--root)', () => {
    let root: string;

    const write = async (file: string, from: string) => {
        const filePath = path.join(root, file);

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(
            filePath,
            `export default { type: 'better-sqlite3', database: ':memory:', extra: { from: '${from}' } };\n`,
        );
    };

    const build = async (preserveFilePaths?: boolean) => {
        const { context } = await buildCLIDataSourceContext({
            dataSource: 'data-source',
            root,
            preserveFilePaths,
        });

        return buildDataSourceOptions(context);
    };

    beforeEach(async () => {
        root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cli-root (x86) '));
    });

    afterEach(async () => {
        await fs.promises.rm(root, { recursive: true, force: true });
    });

    it.each(['database', 'db'])('should find the conventional src/%s/data-source below the root', async (folder) => {
        await write(`src/${folder}/data-source.ts`, 'src');

        expect((await build()).extra).toEqual({ from: 'src' });
        expect((await build(true)).extra).toEqual({ from: 'src' });

        await write(`dist/${folder}/data-source.mjs`, 'dist');

        expect((await build()).extra).toEqual({ from: 'dist' });
        expect((await build(true)).extra).toEqual({ from: 'src' });
    });

    it('should find the conventional src/data-source below the root', async () => {
        await write('src/data-source.ts', 'src');
        await write('dist/data-source.mjs', 'dist');

        expect((await build()).extra).toEqual({ from: 'dist' });
        expect((await build(true)).extra).toEqual({ from: 'src' });
    });

    it('should use an absolute outDir below the root', async () => {
        await fs.promises.writeFile(
            path.join(root, 'tsconfig.json'),
            JSON.stringify({ compilerOptions: { outDir: path.join(root, 'build') } }),
        );
        await write('src/database/data-source.ts', 'src');
        await write('build/database/data-source.mjs', 'build');

        expect((await build()).extra).toEqual({ from: 'build' });
    });
});
