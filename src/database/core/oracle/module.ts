import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
    IDatabaseDialect,
} from '../type';
import { buildOracleCreateDatabaseQuery } from './statements';

export class OracleDialect implements IDatabaseDialect {
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildOracleCreateDatabaseQuery(operation.params.database as string),
            );
        } finally {
            await connection.close();
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
