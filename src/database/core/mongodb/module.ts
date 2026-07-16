import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';

export class MongoDBDialect implements IDatabaseDialect {
    /**
     * Connecting to the target database creates it lazily server side.
     */
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        const connection = await runtime.mongo.connect(operation.params.database);
        await connection.close();

        return undefined;
    }

    async drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown> {
        const connection = await runtime.mongo.connect(operation.params.database);

        try {
            return await connection.dropDatabase();
        } finally {
            await connection.close();
        }
    }
}
