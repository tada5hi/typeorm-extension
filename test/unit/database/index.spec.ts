import path from "path";
import {
    buildDataSourceOptions
} from "../../../src";
import {buildDriverOptions} from "../../../src/database/driver";
import {getCharsetFromDataSourceOptions} from "../../../src/database/driver/utils/charset";

describe('src/database/module.ts', () => {
    const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');

    it('should build simple connection options', async () => {
        const options = await buildDataSourceOptions({
            root: rootPath,
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
        expect(driverOptions.extra.socketPath).toEqual('/var/mysqld/mysqld.sock');
        expect(driverOptions.port).toEqual(3306);
        expect(driverOptions.charset).toEqual('UTF8_GENERAL_CI');
    });

    it('should extend database operation options', async () => {
        const connectionOptions = await buildDataSourceOptions({
            root: rootPath,
            configName: 'ormconfig.json'
        });

        expect(connectionOptions).toBeDefined();

        const charset = getCharsetFromDataSourceOptions(connectionOptions);
        expect(charset).toEqual('UTF8_GENERAL_CI');
    })
})
