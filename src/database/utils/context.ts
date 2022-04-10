import { DatabaseCreateContext, DatabaseDropContext } from '../type';
import { buildDataSourceOptions } from '../../connection';

export async function buildDatabaseCreateContext(
    context?: DatabaseCreateContext,
) : Promise<DatabaseCreateContext> {
    context = context || {};
    context.options = context.options || await buildDataSourceOptions(context.options);

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
    context.options = context.options || await buildDataSourceOptions(context.options);

    if (typeof context.ifExist === 'undefined') {
        context.ifExist = true;
    }

    return context;
}
