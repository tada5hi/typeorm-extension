import type { DataSourceOptions } from 'typeorm';
import type { DatabaseBaseContext, DatabaseCreateContext, DatabaseDropContext } from '../type';
import { buildDataSourceOptions, findDataSource } from '../../data-source';

async function setDatabaseContextOptions<T extends DatabaseBaseContext>(context: T) : Promise<T> {
    if (!context.options) {
        const dataSource = await findDataSource(context.findOptions);
        if (dataSource) {
            context.options = dataSource.options;
        }

        if (!context.options) {
            context.options = await buildDataSourceOptions();
        }
    }

    Object.assign(context.options, {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
    } satisfies Partial<DataSourceOptions>);

    return context;
}

export async function buildDatabaseCreateContext(
    context?: DatabaseCreateContext,
) : Promise<DatabaseCreateContext> {
    context = context || {};

    context = await setDatabaseContextOptions(context);

    if (typeof context.synchronize === 'undefined') {
        context.synchronize = true;
    }

    if (typeof context.ifNotExist === 'undefined') {
        context.ifNotExist = true;
    }

    return context;
}

export async function buildDatabaseDropContext(
    context?: DatabaseDropContext,
) : Promise<DatabaseDropContext> {
    context = context || {};
    context = await setDatabaseContextOptions(context);

    if (typeof context.ifExist === 'undefined') {
        context.ifExist = true;
    }

    return context;
}
