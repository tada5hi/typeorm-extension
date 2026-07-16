import { buildDatabaseCreateContext } from '../../utils/context';
import { resolveDatabaseDialectName } from '../../registry';
import { executeDatabaseCreate } from '../execute';
import type {
    DatabaseCreateContextInput,
} from '../type';

/**
 * Create database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param input
 */
export async function createDatabase(input: DatabaseCreateContextInput = {}) : Promise<unknown> {
    const context = await buildDatabaseCreateContext(input);

    return executeDatabaseCreate(resolveDatabaseDialectName(context.options.type), context);
}
