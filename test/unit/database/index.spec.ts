import path from "path";
import {
    buildConnectionOptions,
    DatabaseOperationOptions,
    extendDatabaseOperationOptions
} from "../../../src";
import {buildDriverConnectionOptions} from "../../../src/database/driver";

describe('src/database/module.ts', () => {
    const rootPath : string = path.resolve(process.cwd(), 'test/data/typeorm');

    it('should build simple connection options', async () => {
        const connectionOptions = await buildConnectionOptions({
            root: rootPath,
            configName: 'ormconfig.json'
        });

        expect(connectionOptions).toBeDefined();

        const simpleConnectionOptions = buildDriverConnectionOptions(connectionOptions);
        expect(simpleConnectionOptions).toBeDefined();
        expect(simpleConnectionOptions.host).toEqual('localhost');
        expect(simpleConnectionOptions.user).toEqual('root');
        expect(simpleConnectionOptions.password).toEqual('admin');
        expect(simpleConnectionOptions.database).toEqual('test');
        expect(simpleConnectionOptions.extra).toBeDefined();
        expect(simpleConnectionOptions.extra.socketPath).toEqual('/var/mysqld/mysqld.sock');
        expect(simpleConnectionOptions.port).toEqual(3306);
    });

    it('should extend database operation options', async () => {
        const connectionOptions = await buildConnectionOptions({
            root: rootPath,
            configName: 'ormconfig.json'
        });

        expect(connectionOptions).toBeDefined();

        const customOptions: DatabaseOperationOptions = extendDatabaseOperationOptions({ifExist: true}, connectionOptions);
        expect(customOptions.ifExist).toEqual(true);
        expect(customOptions.charset).toEqual('UTF8_GENERAL_CI');
    })
})
