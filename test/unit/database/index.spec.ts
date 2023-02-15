import path from "path";
import {
    buildLegacyDataSourceOptions,
} from "../../../src";
import {buildDriverOptions} from "../../../src";
import {getCharsetFromDataSourceOptions} from "../../../src";
import {checkTestDatabase, destroyTestDatabase} from "../../data/typeorm/utils";

describe('src/database/module.ts', () => {
    const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');

    it('should build simple connection options', async () => {
        const options = await buildLegacyDataSourceOptions({
            directory: rootPath,
            configName: 'ormconfig.json'
        });

        expect(options).toBeDefined();

        const driverOptions = buildDriverOptions(options);
        expect(driverOptions).toBeDefined();
        expect(driverOptions.host).toEqual('localhost');
        expect(driverOptions.user).toEqual('root');
        expect(driverOptions.password).toEqual('admin');
        expect(driverOptions.database).toEqual('test');
        expect(driverOptions.extra).toBeDefined();
        if(driverOptions.extra) {
            expect(driverOptions.extra.socketPath).toEqual('/var/mysqld/mysqld.sock');
        }
        expect(driverOptions.port).toEqual(3306);
        expect(driverOptions.charset).toEqual('UTF8_GENERAL_CI');
    });

    it('should extend database operation options', async () => {
        const connectionOptions = await buildLegacyDataSourceOptions({
            directory: rootPath,
            configName: 'ormconfig.json'
        });

        expect(connectionOptions).toBeDefined();

        const charset = getCharsetFromDataSourceOptions(connectionOptions);
        expect(charset).toEqual('UTF8_GENERAL_CI');
    })

    it('should check database',  async () => {
        let check = await checkTestDatabase();

        expect(check).toBeDefined();
        // special case, only for sqlite/file driver
        expect(check.exists).toBeTruthy();

        await destroyTestDatabase();
    })
})
