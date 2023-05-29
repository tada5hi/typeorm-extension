import {
    adjustFilePathsForDataSourceOptions, transformFilePath
} from "../../../src";

describe('src/connection/utils.ts', () => {
    it('should change ts to js path', () => {
        let srcPath = 'src/packages/backend/src/data-source.ts';
        expect(transformFilePath(srcPath)).toEqual('src/packages/backend/dist/data-source.js');

        srcPath = 'src/packages/backend/my-src/data-source.ts';
        expect(transformFilePath(srcPath)).toEqual('src/packages/backend/my-src/data-source.js');

        srcPath = 'src/entities.cts';
        expect(transformFilePath(srcPath)).toEqual('dist/entities.cjs');

        srcPath = 'src/entities.mts';
        expect(transformFilePath(srcPath)).toEqual('dist/entities.mjs');

        srcPath = 'src/ts/entities.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/ts/entities.js');

        srcPath = 'my-src/entities.js';
        expect(transformFilePath(srcPath)).toEqual('my-src/entities.js');

        srcPath = 'my-src/entities.ts'
        expect(transformFilePath(srcPath)).toEqual('my-src/entities.js');

        srcPath = './src/entities.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/entities.js');

        srcPath = 'src/entities.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/entities.js');

        srcPath = '/src/entities.ts';
        expect(transformFilePath(srcPath)).toEqual('/dist/entities.js');

        srcPath = 'src/ts.{ts}';
        expect(transformFilePath(srcPath)).toEqual('dist/ts.{js}');

        srcPath = 'src/ts.ts.{ts,cts}';
        expect(transformFilePath(srcPath)).toEqual('dist/ts.ts.{js,cjs}');

        srcPath = 'src/*.{ts,cts}';
        expect(transformFilePath(srcPath)).toEqual('dist/*.{js,cjs}');

        srcPath = 'src/ts.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/ts.js');

        const srcPaths = ['src/entities.ts', './src/entities.ts'];
        for(let i=0; i<srcPaths.length; i++) {
            srcPath = srcPaths[i];

            expect(transformFilePath(srcPath, 'dist')).toEqual('dist/entities.js');
            expect(transformFilePath(srcPath, './dist')).toEqual('dist/entities.js');
            expect(transformFilePath(srcPath, 'dist/')).toEqual('dist/entities.js');
            expect(transformFilePath(srcPath, '/dist/')).toEqual('/dist/entities.js');

            expect(transformFilePath(srcPath, undefined, 'src')).toEqual('dist/entities.js');
            expect(transformFilePath(srcPath, undefined, './src')).toEqual('dist/entities.js');
            expect(transformFilePath(srcPath, undefined, 'src/')).toEqual('dist/entities.js');

            expect(transformFilePath(srcPath, './dist', './src')).toEqual('dist/entities.js');
        }

        srcPath = 'src/entities.ts';
        expect(transformFilePath(srcPath, 'output')).toEqual('output/entities.js');
    });

    it('should change ts to js path with pattern', () => {
        let srcPath = 'src/entities.{ts,cts,mts}';
        expect(transformFilePath(srcPath)).toEqual('dist/entities.{js,cjs,mjs}');

        srcPath = 'src/**/entities.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/**/entities.js');

        srcPath = 'src/*.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/*.js');

        srcPath = 'src/ts/*.ts';
        expect(transformFilePath(srcPath)).toEqual('dist/ts/*.js');
    })

    it('should not change ts to js path', () => {
        let srcPath = 'src/entities.ts';
        expect(transformFilePath(srcPath, undefined, 'dummySrc')).toEqual('src/entities.js');

        expect(transformFilePath(srcPath, undefined, '../src')).toEqual('src/entities.js');
    })

    it('should modify connection option(s) for runtime environment', async () => {
        const modifiedConnectionOptions = await adjustFilePathsForDataSourceOptions({
            factories: ['src/factories.ts'],
            seeds: ['src/seeds.ts'],
            entities: ['src/entities.ts'],
            subscribers: ['src/subscribers.ts']
        });

        expect(modifiedConnectionOptions).toEqual({
            factories: ['dist/factories.js'],
            seeds: ['dist/seeds.js'],
            entities: ['dist/entities.js'],
            subscribers: ['dist/subscribers.js']
        });

        let modifiedConnectionOption = await adjustFilePathsForDataSourceOptions({
            entities: ['./src/entities.ts']
        });
        expect(modifiedConnectionOption).toEqual({entities: ['dist/entities.js']});

        const modifiedConnectionOptionAlt = await adjustFilePathsForDataSourceOptions({
            entities: ['src/entities.ts']
        });
        expect(modifiedConnectionOptionAlt).toEqual({entities: ['dist/entities.js']});
    })
});
