import type { DialectRuntime } from '../../../src/database/core';
import { MemoryDatabaseConnector } from './memory-database-connector';
import { MemoryFileSystem } from './memory-file-system';
import { MemoryMongoDatabaseConnector } from './memory-mongo-connector';

export function createMemoryRuntime(input: Partial<DialectRuntime> = {}): DialectRuntime {
    return {
        connector: input.connector || new MemoryDatabaseConnector(),
        mongo: input.mongo || new MemoryMongoDatabaseConnector(),
        fs: input.fs || new MemoryFileSystem(),
        cwd: input.cwd || '/cwd',
    };
}
