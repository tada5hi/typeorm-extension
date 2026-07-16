import type { DialectRuntime } from '../../../src/database/core';
import { MemoryDatabaseServer } from './memory-database-server';
import { MemoryFileSystem } from './memory-file-system';
import { MemoryMongoDatabaseServer } from './memory-mongo-server';

export function createMemoryRuntime(input: Partial<DialectRuntime> = {}): DialectRuntime {
    return {
        server: input.server || new MemoryDatabaseServer(),
        mongo: input.mongo || new MemoryMongoDatabaseServer(),
        fs: input.fs || new MemoryFileSystem(),
        cwd: input.cwd || '/cwd',
    };
}
