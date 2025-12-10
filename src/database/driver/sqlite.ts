import path from 'node:path';
import fs from 'node:fs';
import { OptionsError } from '../../errors';
import type { DatabaseCreateContext, DatabaseDropContext } from '../methods';
import { buildDriverOptions } from './utils';
import { synchronizeDatabaseSchema } from '../utils';

export async function createSQLiteDatabase(
    context: DatabaseCreateContext,
) : Promise<void> {
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
        await synchronizeDatabaseSchema(context.options);
    }
}

export async function dropSQLiteDatabase(
    context: DatabaseDropContext,
) {
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
