import path from 'path';
import fs from 'fs';

import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import { DriverConnectionOptions } from '../../connection';
import { DatabaseOperationOptions } from '../type';

export async function createSQLiteDatabase(
    driver: SqliteDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) : Promise<void> {
    const filePath : string = path.isAbsolute(connectionOptions.database) ?
        connectionOptions.database :
        path.join(process.cwd(), connectionOptions.database);

    const directoryPath : string = path.dirname(filePath);

    await fs.promises.access(directoryPath, fs.constants.W_OK);
}

export async function dropSQLiteDatabase(
    driver: SqliteDriver,
    connectionOptions: DriverConnectionOptions,
    customOptions: DatabaseOperationOptions,
) {
    const filePath : string = path.isAbsolute(connectionOptions.database) ?
        connectionOptions.database :
        path.join(process.cwd(), connectionOptions.database);

    try {
        await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
        await fs.promises.unlink(filePath);
    } catch (e) {
        // ...
    }
}
