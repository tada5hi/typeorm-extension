import {buildDataSourceOptions, setDefaultSeederOptions} from "../../../src";
import * as path from "path";

describe('src/connection/index.ts', () => {
    it('should build connection options', async () => {
        const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');
        const connectionOptions = await buildDataSourceOptions({
            root: rootPath,
            configName: 'ormconfig.json'
        });

        let ormConfig = require('../../data/typeorm/ormconfig.json');
        ormConfig = setDefaultSeederOptions(ormConfig);

        expect(connectionOptions).toEqual(ormConfig);
    })
})
