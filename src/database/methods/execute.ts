import type { DataSourceOptions } from 'typeorm';
import { NodeFileSystemPort, UnsupportedServerPort } from '../adapters';
import type {
    ConnectionParams,
    DatabaseDialectName,
    DatabaseDialectRegistryEntry,
    DialectRuntime,
    IDatabaseConnection,
    IDatabaseServerPort,
} from '../core';
import { useDatabaseDialectEntry } from '../registry';
import { synchronizeDatabaseSchema } from '../utils';
import type { DatabaseCreateContext, DatabaseDropContext } from './type';

/**
 * Wraps a caller supplied connection as a server port.
 * The caller owns the lifecycle — close() never touches it.
 */
class InjectedConnectionServerPort implements IDatabaseServerPort {
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

function buildDialectRuntime(
    entry: DatabaseDialectRegistryEntry,
    options: DataSourceOptions,
    params: ConnectionParams,
    overrides: Partial<DialectRuntime>,
): DialectRuntime {
    return {
        server: overrides.server ||
            (entry.buildServerPort ?
                entry.buildServerPort(options, params) :
                new UnsupportedServerPort(options.type)),
        mongo: overrides.mongo ||
            (entry.buildMongoPort ?
                entry.buildMongoPort(options, params) :
                new UnsupportedServerPort(options.type)),
        fs: overrides.fs || new NodeFileSystemPort(),
        cwd: overrides.cwd || process.cwd(),
    };
}

/**
 * Composition root for the create operation: resolves the registry entry,
 * derives connection params once, wires ports (honouring overrides and a
 * caller supplied connection) and runs the schema synchronization exactly once.
 */
export async function executeDatabaseCreate(
    name: DatabaseDialectName,
    context: DatabaseCreateContext,
    runtime: Partial<DialectRuntime> = {},
): Promise<unknown> {
    const entry = useDatabaseDialectEntry(name);
    const params = entry.buildParams(context.options);

    const overrides = { ...runtime };
    if (context.connection && !overrides.server) {
        overrides.server = new InjectedConnectionServerPort(context.connection);
    }

    const output = await entry.dialect.create(
        {
            params,
            ifNotExist: context.ifNotExist,
            initialDatabase: context.initialDatabase,
        },
        buildDialectRuntime(entry, context.options, params, overrides),
    );

    if (context.synchronize) {
        await synchronizeDatabaseSchema(context.options);
    }

    return output;
}

export async function executeDatabaseDrop(
    name: DatabaseDialectName,
    context: DatabaseDropContext,
    runtime: Partial<DialectRuntime> = {},
): Promise<unknown> {
    const entry = useDatabaseDialectEntry(name);
    const params = entry.buildParams(context.options);

    const overrides = { ...runtime };
    if (context.connection && !overrides.server) {
        overrides.server = new InjectedConnectionServerPort(context.connection);
    }

    return entry.dialect.drop(
        {
            params,
            ifExist: context.ifExist ?? true,
            initialDatabase: context.initialDatabase,
        },
        buildDialectRuntime(entry, context.options, params, overrides),
    );
}
