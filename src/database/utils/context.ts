import type { DataSourceOptions } from 'typeorm';
import { buildDataSourceOptions, findDataSource } from '../../data-source';
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
        options = {
            ...context.options,
        };
    } else {
        const dataSource = await findDataSource(context.findOptions);
        if (dataSource) {
            options = {
                ...dataSource.options,
            };
        }

        if (!options) {
            options = {
                ...await buildDataSourceOptions(),
            };
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
