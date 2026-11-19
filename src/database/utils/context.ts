import type { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions, findDataSourceOptions } from '../../data-source';
import type {
    DatabaseBaseContextInput,
    DatabaseCreateContext,
    DatabaseCreateContextInput,
    DatabaseDropContext,
    DatabaseDropContextInput,
} from '../methods';

async function normalizeDataSourceOptions(context: DatabaseBaseContextInput) : Promise<DataSourceOptions> {
    let options : DataSourceOptions | undefined;

    if (context.options) {
        options = { ...context.options };
    } else {
        const fileOptions = await findDataSourceOptions(context.findOptions);

        if (fileOptions) {
            options = { ...fileOptions };
        }

        if (!options) {
            options = { ...await buildDataSourceOptions() };
        }
    }

    return {
        ...options,

        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    };
}

export async function buildDatabaseCreateContext(
    input: DatabaseCreateContextInput = {},
) : Promise<DatabaseCreateContext> {
    return {
        ...input,
        options: await normalizeDataSourceOptions(input),
        synchronize: input.synchronize ?? true,
        ifNotExist: input.ifNotExist ?? true,
    };
}

export async function buildDatabaseDropContext(
    input: DatabaseDropContextInput = {},
) : Promise<DatabaseDropContext> {
    return {
        ...input,
        options: await normalizeDataSourceOptions(input),
        ifExist: input.ifExist ?? true,
    };
}
