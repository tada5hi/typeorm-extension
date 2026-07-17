import type {
    DatabaseDialectName,
    DatabaseDialectOverrides,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { useDatabaseDialectEntry } from '../registry';
import { synchronizeDatabaseSchema } from '../utils';
import type { DatabaseCreateContext, DatabaseDropContext } from './type';

/**
 * Wraps a caller supplied session as a connector.
 * The session is treated as already open, and the caller owns the
 * lifecycle — open() and close() never touch it.
 */
class InjectedConnector implements IDatabaseConnector {
    constructor(protected injected: Pick<IDatabaseSession, 'execute'>) {
        this.injected = injected;
    }

    session(): IDatabaseSession {
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
    if (context.session && !overrides.connector) {
        return {
            ...overrides,
            connector: new InjectedConnector(context.session),
        };
    }

    return overrides;
}

/**
 * Composition root for the create operation: resolves the registry entry,
 * derives connection params once, builds the dialect with its connector
 * (honouring overrides and a caller supplied session) and runs the
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
