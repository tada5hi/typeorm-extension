import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
    IDatabaseDialect,
} from '../type';
import { buildMongoDBDropDatabaseCommand } from './statements';

export class MongoDBDialect implements IDatabaseDialect {
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    /**
     * Connecting to the target database creates it lazily server side.
     */
    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.params.database);
        await connection.open();
        await connection.close();

        return undefined;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.params.database);
        await connection.open();

        try {
            return await connection.execute(buildMongoDBDropDatabaseCommand());
        } finally {
            await connection.close();
        }
    }
}
