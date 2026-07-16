import type {
    DatabaseDialectName,
    DatabaseDialectOverrides,
    IDatabaseConnection,
    IDatabaseConnector,
} from '../core';
import { useDatabaseDialectEntry } from '../registry';
import { synchronizeDatabaseSchema } from '../utils';
import type { DatabaseCreateContext, DatabaseDropContext } from './type';

/**
 * Wraps a caller supplied connection as a connector.
 * The caller owns the lifecycle — close() never touches it.
 */
class InjectedConnector implements IDatabaseConnector {
    constructor(protected connection: IDatabaseConnection) {
        this.connection = connection;
    }

    async connect(): Promise<IDatabaseConnection> {
        const { connection } = this;

        return {
            execute: (sql: string) => connection.execute(sql),
            close: () => Promise.resolve(),
        };
    }
}

function buildOverrides(
    context: DatabaseCreateContext | DatabaseDropContext,
    overrides: DatabaseDialectOverrides,
): DatabaseDialectOverrides {
    if (context.connection && !overrides.connector) {
        return {
            ...overrides,
            connector: new InjectedConnector(context.connection),
        };
    }

    return overrides;
}

/**
 * Composition root for the create operation: resolves the registry entry,
 * derives connection params once, builds the dialect with its connector
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
