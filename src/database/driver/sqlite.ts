import path from 'path';
import fs from 'fs';

import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import { DatabaseCreateOperationContext, DatabaseDeleteOperationContext } from '../type';
import { DriverOptions } from './type';

export async function createSQLiteDatabase(
    driver: SqliteDriver,
    options: DriverOptions,
    operationContext: DatabaseCreateOperationContext,
) : Promise<void> {
    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    const directoryPath : string = path.dirname(filePath);

    await fs.promises.access(directoryPath, fs.constants.W_OK);
}

export async function dropSQLiteDatabase(
    driver: SqliteDriver,
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
