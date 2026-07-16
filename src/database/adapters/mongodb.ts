import type { DataSourceOptions } from 'typeorm';
import type { MongoDriver } from 'typeorm/driver/mongodb/MongoDriver';
import type {
    ConnectionParams,
    IMongoDatabaseConnection,
    IMongoDatabaseConnector,
} from '../core';
import { buildMongoDBConnectionUri } from '../core';
import { useNativeDriver } from './typeorm-driver';

export class MongoDBConnector implements IMongoDatabaseConnector {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    async connect(database?: string): Promise<IMongoDatabaseConnection> {
        const driver = useNativeDriver(this.options) as MongoDriver;
        const { MongoClient } = driver.mongodb;

        const client = new MongoClient(buildMongoDBConnectionUri(this.params, database));
        await client.connect();

        return {
            dropDatabase: () => client.db().dropDatabase(),
            close: () => client.close(),
        };
    }
}
