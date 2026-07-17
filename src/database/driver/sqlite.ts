import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { executeDatabaseCreate, executeDatabaseDrop } from '../methods/execute';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../utils';

/**
 * @deprecated Use createDatabase() instead — dialect dispatch is automatic.
 */
export async function createSQLiteDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('better-sqlite3', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropSQLiteDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('better-sqlite3', context);
}
