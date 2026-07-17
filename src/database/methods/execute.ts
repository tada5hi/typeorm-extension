import type {
    DatabaseDialectName,
    DatabaseDialectOverrides,
    IDatabaseConnection,
    IDatabaseConnectionFactory,
} from '../core';
import { useDatabaseDialectEntry } from '../registry';
import { synchronizeDatabaseSchema } from '../utils';
import type { DatabaseCreateContext, DatabaseDropContext } from './type';

/**
 * Wraps a caller supplied connection as a connection factory.
 * The connection is treated as already open, and the caller owns the
 * lifecycle — open() and close() never touch it.
 */
class InjectedConnectionFactory implements IDatabaseConnectionFactory {
    constructor(protected injected: Pick<IDatabaseConnection, 'execute'>) {
        this.injected = injected;
    }

    create(): IDatabaseConnection {
        const { injected } = this;

        return {
            open: () => Promise.resolve(),
            execute: (statement: string) => injected.execute(statement),
            close: () => Promise.resolve(),
        };
    }
}

function buildOverrides(
    context: DatabaseCreateContext | DatabaseDropContext,
    overrides: DatabaseDialectOverrides,
): DatabaseDialectOverrides {
    if (context.connection && !overrides.connectionFactory) {
        return {
            ...overrides,
            connectionFactory: new InjectedConnectionFactory(context.connection),
        };
    }

    return overrides;
}

/**
 * Composition root for the create operation: resolves the registry entry,
 * derives connection params once, builds the dialect with its connection factory
 * (honouring overrides and a caller supplied connection) and runs the
 * schema synchronization exactly once.
 */
export async function executeDatabaseCreate(
    name: DatabaseDialectName,
    context: DatabaseCreateContext,
    overrides: DatabaseDialectOverrides = {},
): Promise<unknown> {
    const entry = useDatabaseDialectEntry(name);
    const params = entry.buildParams(context.options);

    const dialect = entry.buildDialect(context.options, params, buildOverrides(context, overrides));

    const output = await dialect.create({
        params,
        ifNotExist: context.ifNotExist,
        initialDatabase: context.initialDatabase,
    });

    if (context.synchronize) {
        await synchronizeDatabaseSchema(context.options);
    }

    return output;
}

export async function executeDatabaseDrop(
    name: DatabaseDialectName,
    context: DatabaseDropContext,
    overrides: DatabaseDialectOverrides = {},
): Promise<unknown> {
    const entry = useDatabaseDialectEntry(name);
    const params = entry.buildParams(context.options);

    const dialect = entry.buildDialect(context.options, params, buildOverrides(context, overrides));

    return dialect.drop({
        params,
        ifExist: context.ifExist ?? true,
        initialDatabase: context.initialDatabase,
    });
}
