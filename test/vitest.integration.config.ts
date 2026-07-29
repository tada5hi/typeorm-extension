import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Driver specific suites which need a real database server.
 * Configured through TYPEORM_CONNECTION / TYPEORM_HOST / ... — the suites skip
 * themselves if no driver is set.
 */
export default defineConfig({
    plugins: [
        swc.vite({
            jsc: {
                parser: {
                    syntax: 'typescript',
                    decorators: true,
                },
                transform: {
                    legacyDecorator: true,
                    decoratorMetadata: true,
                },
                target: 'es2022',
            },
        }),
    ],
    oxc: false,
    test: {
        globals: true,
        root: path.resolve(import.meta.dirname, '..'),
        include: ['test/integration/**/*.{test,spec}.{js,ts}'],
        setupFiles: ['test/vitest.setup.ts'],
        // a shared database server can not serve two suites at once
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
