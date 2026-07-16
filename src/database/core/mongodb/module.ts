import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseDialect,
    IMongoDatabaseConnector,
} from '../type';

export class MongoDBDialect implements IDatabaseDialect {
    constructor(protected connector: IMongoDatabaseConnector) {
        this.connector = connector;
    }

    /**
     * Connecting to the target database creates it lazily server side.
     */
    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = await this.connector.connect(operation.params.database);
        await connection.close();

        return undefined;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const connection = await this.connector.connect(operation.params.database);

        try {
            return await connection.dropDatabase();
        } finally {
            await connection.close();
        }
    }
}
