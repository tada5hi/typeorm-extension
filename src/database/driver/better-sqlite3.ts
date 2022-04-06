import path from 'path';
import fs from 'fs';

import { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';

import { DatabaseCreateOperationContext, DatabaseDeleteOperationContext } from '../type';
import { DriverOptions } from './type';

export async function createBetterSQLite3Database(
    driver: BetterSqlite3Driver,
    options: DriverOptions,
    operationContext: DatabaseCreateOperationContext,
) : Promise<void> {
    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    const directoryPath : string = path.dirname(filePath);

    await fs.promises.access(directoryPath, fs.constants.W_OK);
}

export async function dropBetterSQLite3Database(
    driver: BetterSqlite3Driver,
    options: DriverOptions,
    operationContext: DatabaseDeleteOperationContext,
) {
    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    try {
        await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
        await fs.promises.unlink(filePath);
    } catch (e) {
        // ...
    }
}
