import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

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
        include: ['test/unit/**/*.{test,spec}.{js,ts}'],
        setupFiles: ['test/vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx,js,jsx}'],
            exclude: [
                'src/**/*.d.ts',
                'src/cli/**/*.{ts,js}',
                'src/database/**/*.{ts,js}',
                'src/env/utils.ts',
                'src/errors/*.{ts,js}',
                'src/utils/**/*.{ts,js}',
                'src/seeder/**/*.{ts,js}',
            ],
            thresholds: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80,
            },
        },
    },
});
