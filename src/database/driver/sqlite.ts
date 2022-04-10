import path from 'path';
import fs from 'fs';
import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { buildDataSourceOptions } from '../../connection';
import { buildDriverOptions } from './utils';

export async function createSQLiteDatabase(
    context?: DatabaseCreateContext,
) : Promise<void> {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

    const options = buildDriverOptions(context.options);

    const filePath : string = path.isAbsolute(options.database) ?
        options.database :
        path.join(process.cwd(), options.database);

    const directoryPath : string = path.dirname(filePath);

    await fs.promises.access(directoryPath, fs.constants.W_OK);
}

export async function dropSQLiteDatabase(
    context: DatabaseDropContext,
) {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

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
