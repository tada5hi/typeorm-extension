import path from 'node:path';
import process from 'node:process';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';
import { createPathResolver } from '../../../src';

const JIT_MARKER = Symbol.for('ts-node.register.instance');

const simulateJIT = () => {
    (process as any)[JIT_MARKER] = {};
};

describe('src/utils/path-resolver', () => {
    afterEach(() => {
        delete (process as any)[JIT_MARKER];
    });

    describe('transform', () => {
        it('should transform plain paths', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            expect(await resolver.transform('src/entities.ts')).toEqual('out/entities.js');
            expect(await resolver.transform('/src/entities.mts')).toEqual('/out/entities.mjs');
        });

        it('should transform glob patterns with brace expansion', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            expect(await resolver.transform('src/**/*.{ts,cts}')).toEqual('out/**/*.{js,cjs}');
        });

        it('should transform in auto mode when no just-in-time environment is detected', async () => {
            const resolver = createPathResolver({ tsconfig: { compilerOptions: { outDir: 'out' } } });

            expect(await resolver.transform('src/entities.ts')).toEqual('out/entities.js');
        });

        it('should not transform in auto mode when a just-in-time environment is detected', async () => {
            simulateJIT();

            const resolver = createPathResolver({ tsconfig: { compilerOptions: { outDir: 'out' } } });

            expect(await resolver.transform('src/entities.ts')).toEqual('src/entities.ts');
        });

        it('should transform in transform mode despite a just-in-time environment', async () => {
            simulateJIT();

            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            expect(await resolver.transform('src/entities.ts')).toEqual('out/entities.js');
        });

        it('should not transform in preserve mode, even with an outDir configured', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'preserve',
            });

            expect(await resolver.transform('src/entities.ts')).toEqual('src/entities.ts');
            expect(await resolver.transform('src/**/*.{ts,cts}')).toEqual('src/**/*.{ts,cts}');
        });
    });

    describe('absolutize & resolve', () => {
        it('should keep absolute paths untouched', () => {
            const input = path.join(path.sep, 'app', 'file.ts');
            const resolver = createPathResolver();

            expect(resolver.absolutize(input)).toEqual(input);
        });

        it('should absolutize relative paths against the root', () => {
            const resolver = createPathResolver({ root: path.join(path.sep, 'app') });

            expect(resolver.absolutize('file.ts')).toEqual(
                path.join(path.sep, 'app', 'file.ts'),
            );
        });

        it('should absolutize relative paths against the working directory by default', () => {
            const resolver = createPathResolver();

            expect(resolver.absolutize('file.ts')).toEqual(
                path.resolve(process.cwd(), 'file.ts'),
            );
        });

        it('should absolutize and transform', async () => {
            const resolver = createPathResolver({
                root: path.join(path.sep, 'app'),
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            expect(await resolver.resolve('src/entities.ts')).toEqual('/app/out/entities.js');
        });

        it('should only absolutize in preserve mode', async () => {
            const resolver = createPathResolver({
                root: path.join(path.sep, 'app'),
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'preserve',
            });

            expect(await resolver.resolve('src/entities.ts')).toEqual(
                path.join(path.sep, 'app', 'src', 'entities.ts'),
            );
        });
    });

    describe('transformKeys', () => {
        it('should transform string and string-array values of the given keys', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            const input = {
                seeds: ['src/seeds/*.ts', 42],
                seedName: 'src/seeds/user.ts',
                factories: undefined,
                untouched: 'src/other.ts',
            };

            const output = await resolver.transformKeys(input, ['seeds', 'seedName', 'factories']);

            expect(output).toBe(input);
            expect(output.seeds).toEqual(['out/seeds/*.js', 42]);
            expect(output.seedName).toEqual('out/seeds/user.js');
            expect(output.factories).toBeUndefined();
            expect(output.untouched).toEqual('src/other.ts');
        });

        it('should default to all keys', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'transform',
            });

            const output = await resolver.transformKeys({
                entities: ['src/entities.ts'],
                seedName: 'src/seeds/user.ts',
            });

            expect(output.entities).toEqual(['out/entities.js']);
            expect(output.seedName).toEqual('out/seeds/user.js');
        });

        it('should keep the input untouched in preserve mode', async () => {
            const resolver = createPathResolver({
                tsconfig: { compilerOptions: { outDir: 'out' } },
                mode: 'preserve',
            });

            const output = await resolver.transformKeys({ entities: ['src/entities.ts'] });

            expect(output.entities).toEqual(['src/entities.ts']);
        });
    });

    describe('tsconfig', () => {
        it('should read the tsconfig file relative to the root', async () => {
            const resolver = createPathResolver({ root: 'test/data' });

            const tsconfig = await resolver.tsconfig();
            expect(tsconfig.compilerOptions?.outDir).toEqual('output');

            expect(await resolver.transform('src/entities.ts')).toEqual('output/entities.js');
        });

        it('should use a tsconfig object as is', async () => {
            const input = { compilerOptions: { outDir: 'out' } };
            const resolver = createPathResolver({ tsconfig: input });

            expect(await resolver.tsconfig()).toBe(input);
        });

        it('should fall back to an empty tsconfig when the file is missing', async () => {
            const resolver = createPathResolver({
                tsconfig: 'non-existing-tsconfig.json',
                mode: 'transform',
            });

            expect(await resolver.tsconfig()).toEqual({});

            // no outDir -> default dist
            expect(await resolver.transform('src/entities.ts')).toEqual('dist/entities.js');
        });
    });
});
