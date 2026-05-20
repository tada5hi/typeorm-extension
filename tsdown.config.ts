import path from 'node:path';
import process from 'node:process';
import { defineConfig } from 'tsdown';

const cwd = process.cwd();

const toPosix = (input: string) => input.split(path.sep).join('/');

const cliRewriteExternal = {
    name: 'cli-rewrite-external',
    resolveId(source: string, importer: string | undefined) {
        if (!importer) {
            return null;
        }

        const importerPosix = toPosix(importer);
        const cwdPosix = toPosix(cwd);

        const importerRelative = importerPosix.startsWith(`${cwdPosix}/`) ?
            importerPosix.substring(cwdPosix.length + 1) :
            importerPosix;

        if (!importerRelative.startsWith('src/cli/')) {
            return null;
        }

        // Externalise an upward-traversing import to the published package
        // only when its resolved target actually leaves src/cli/, so the CLI
        // shares singleton state (DataSource registry, env cache, factory
        // manager) with the library the consumer imports. Imports that go up
        // but stay inside src/cli/ (e.g. ../utils from src/cli/commands/foo)
        // continue to bundle into the CLI as normal.
        if (source.startsWith('../')) {
            const importerDir = path.posix.dirname(importerRelative);
            const resolved = path.posix.normalize(path.posix.join(importerDir, source));

            if (!resolved.startsWith('src/cli/')) {
                return { id: 'typeorm-extension', external: true };
            }
        }

        return null;
    },
};

// Node's strict ESM resolver rejects bare `typeorm/<deep>` imports that aren't
// in typeorm's package "exports" map. Appending `.js` makes Node fall back to
// raw filesystem resolution, which still finds the file. Matches the original
// rollup behaviour and is only needed for runtime imports; type-only imports
// are erased before this runs.
const typeormDeepImportExtension = {
    name: 'typeorm-deep-import-extension',
    renderChunk(code: string) {
        return code.replace(
            /from(\s*)(['"])typeorm(\/[^'"]+?)(?<!\.js)\2/g,
            'from$1$2typeorm$3.js$2',
        );
    },
};

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        format: 'esm',
        outDir: 'dist',
        dts: true,
        sourcemap: true,
        clean: true,
        platform: 'node',
        deps: { neverBundle: ['typescript'] },
        plugins: [typeormDeepImportExtension],
    },
    {
        entry: { cli: 'src/cli/index.ts' },
        format: 'esm',
        outDir: 'bin',
        dts: false,
        sourcemap: true,
        clean: true,
        platform: 'node',
        deps: { neverBundle: [/^yargs/] },
        plugins: [cliRewriteExternal],
    },
]);
