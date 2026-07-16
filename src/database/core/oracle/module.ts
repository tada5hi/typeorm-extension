import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnector,
    IDatabaseDialect,
} from '../type';
import { buildOracleCreateDatabaseQuery } from './statements';

export class OracleDialect implements IDatabaseDialect {
    constructor(protected connector: IDatabaseConnector) {
        this.connector = connector;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const session = await this.connector.connect(operation.initialDatabase);

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
    async drop(_operation: DatabaseDropOperation): Promise<unknown> {
        return Promise.resolve();
    }
}
