import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnector,
    IDatabaseDialect,
} from '../type';
import { buildMongoDBDropDatabaseCommand } from './statements';

export class MongoDBDialect implements IDatabaseDialect {
    constructor(protected connector: IDatabaseConnector) {
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
            return await session.execute(buildMongoDBDropDatabaseCommand());
        } finally {
            await session.close();
        }
    }
}
