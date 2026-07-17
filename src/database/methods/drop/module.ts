import { buildDatabaseDropContext } from '../../utils/context';
import { resolveDatabaseDialectName } from '../../registry';
import { executeDatabaseDrop } from '../execute';
import type {
    DatabaseDropContextInput,
} from '../type';

/**
 * Drop database for specified driver in ConnectionOptions.
 *
 * @throws DriverError
 * @throws OptionsError
 *
 * @param input
 */
export async function dropDatabase(input: DatabaseDropContextInput = {}) : Promise<unknown> {
    const context = await buildDatabaseDropContext(input);

    return executeDatabaseDrop(resolveDatabaseDialectName(context.options.type), context);
}
