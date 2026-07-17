import type {
    DatabaseCreateContextInput,
    DatabaseDropContextInput,
} from '../methods';
import { executeDatabaseCreate, executeDatabaseDrop } from '../methods/execute';
import { buildDatabaseCreateContext, buildDatabaseDropContext } from '../utils';

/**
 * @deprecated Use createDatabase() instead — dialect dispatch is automatic.
 */
export async function createMsSQLDatabase(
    input: DatabaseCreateContextInput = {},
) {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate('mssql', context);
}

/**
 * @deprecated Use dropDatabase() instead — dialect dispatch is automatic.
 */
export async function dropMsSQLDatabase(
    input: DatabaseDropContextInput = {},
) {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop('mssql', context);
}
