import path from 'path';
import fs from 'fs';
import { OptionsError } from '../../errors';
import type { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { buildDriverOptions } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, setupDatabaseSchema } from '../utils';

export async function createSQLiteDatabase(
    context?: DatabaseCreateContext,
) : Promise<void> {
    context = await buildDatabaseCreateContext(context);

    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    if (!options.database) {
        throw OptionsError.databaseNotDefined();
    }

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

    if (!context.options) {
        throw OptionsError.undeterminable();
    }

    const options = buildDriverOptions(context.options);
    if (!options.database) {
        throw OptionsError.databaseNotDefined();
    }

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
