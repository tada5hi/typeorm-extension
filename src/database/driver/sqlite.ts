import path from 'path';
import fs from 'fs';
import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { buildDriverOptions } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, setupDatabaseSchema } from '../utils';

export async function createSQLiteDatabase(
    context?: DatabaseCreateContext,
) : Promise<void> {
    context = await buildDatabaseCreateContext(context);

    const options = buildDriverOptions(context.options);

    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    const directoryPath : string = path.dirname(filePath);

    await fs.promises.access(directoryPath, fs.constants.W_OK);

    if (context.synchronize) {
        await setupDatabaseSchema(context.options);
    }
}

export async function dropSQLiteDatabase(
    context: DatabaseDropContext,
) {
    context = await buildDatabaseDropContext(context);

    const options = buildDriverOptions(context.options);

    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    try {
        await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
        if (context.ifExist) {
            await fs.promises.unlink(filePath);
        }
    } catch (e) {
        // ...
    }
}
