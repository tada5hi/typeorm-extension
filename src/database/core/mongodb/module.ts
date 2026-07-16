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
        const session = this.connector.session(operation.params.database);
        await session.open();
        await session.close();

        return undefined;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const session = this.connector.session(operation.params.database);
        await session.open();

        try {
            return await session.dropDatabase();
        } finally {
            await session.close();
        }
    }
}
