import path from 'node:path';
import fs from 'node:fs';
import { OptionsError } from '../../errors';
import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { buildDriverOptions } from './utils';
import { buildDatabaseCreateContext, buildDatabaseDropContext, synchronizeDatabaseSchema } from '../utils';

export async function createSQLiteDatabase(
    input: DatabaseCreateContextInput,
) : Promise<void> {
    const context = await buildDatabaseCreateContext(input);
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
    input: DatabaseDropContextInput,
) {
    const context = await buildDatabaseDropContext(input);
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
