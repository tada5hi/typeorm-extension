import {
    changeTSToJSPath,
    modifyDataSourceOptionForRuntimeEnvironment,
    modifyDataSourceOptionsForRuntimeEnvironment
} from "../../../src";

describe('src/connection/utils.ts', () => {
    it('should change ts to js path', () => {
        let dirPath = 'src/packages/backend/src/data-source.ts';

        let distDirPath = changeTSToJSPath(dirPath);

        expect(distDirPath).toEqual('src/packages/backend/dist/data-source.js');
    });

    it('should modify connection option(s) for runtime environment', async () => {
        let options : Record<string, any> = {
            factories: ['src/factories.ts'],
            seeds: ['src/seeds.ts'],
            entities: ['src/entities.ts'],
            subscribers: ['src/subscribers.ts']
        };

        const modifiedConnectionOptions = modifyDataSourceOptionsForRuntimeEnvironment(Object.assign({},options));

        expect(modifiedConnectionOptions).toEqual({
            factories: ['dist/factories.js'],
            seeds: ['dist/seeds.js'],
            entities: ['dist/entities.js'],
            subscribers: ['dist/subscribers.js']
        });

        let modifiedConnectionOption = modifyDataSourceOptionForRuntimeEnvironment({
            entities: ['./src/entities.ts']
        }, 'entities');

        expect(modifiedConnectionOption).toEqual({entities: ['./dist/entities.js']});

        const modifiedConnectionOptionAlt = modifyDataSourceOptionForRuntimeEnvironment({
            entities: 'src/entities.ts'
        }, 'entities');
        expect(modifiedConnectionOptionAlt).toEqual({entities: 'dist/entities.js'});

        modifiedConnectionOption = modifyDataSourceOptionForRuntimeEnvironment(
            {
            entities: ['src/entities.ts']
        }, 'entities',
            {
            dist: 'output'
        });
        expect(modifiedConnectionOption).toEqual({entities: ['output/entities.js']});

        modifiedConnectionOption = modifyDataSourceOptionForRuntimeEnvironment(
            {
                entities: ['src/entities.ts']
            }, 'entities',
            {
                src: 'dummySrc'
            });
        expect(modifiedConnectionOption).toEqual({entities: ['src/entities.js']});
    })
});
