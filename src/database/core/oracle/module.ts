import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';
import { buildOracleCreateDatabaseQuery } from './statements';

export class OracleDialect implements IDatabaseDialect {
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.connector.connect(operation.initialDatabase);

        try {
            return await session.execute(
                buildOracleCreateDatabaseQuery(operation.params.database as string),
            );
        } finally {
            await session.close();
        }
    }

    /**
     * Dropping a database is not supported for oracle
     * (preserved behaviour of the previous implementation).
     */
    async drop(_operation: DatabaseDropOperation, _runtime: DialectRuntime): Promise<unknown> {
        return Promise.resolve();
    }
}
