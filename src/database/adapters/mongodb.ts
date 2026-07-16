import type { DataSourceOptions } from 'typeorm';
import type { MongoDriver } from 'typeorm/driver/mongodb/MongoDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IMongoDatabaseConnector,
    IMongoDatabaseSession,
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

    session(database?: string): IMongoDatabaseSession {
        const { options, params } = this;
        let client: any;

        return {
            open: async () => {
                if (client) {
                    return;
                }

                const driver = useNativeDriver(options) as MongoDriver;
                const { MongoClient } = driver.mongodb;

                client = new MongoClient(buildMongoDBConnectionUri(params, database));
                await client.connect();
            },
            dropDatabase: () => {
                if (!client) {
                    return Promise.reject(DriverError.sessionNotOpen());
                }

                return client.db().dropDatabase();
            },
            close: async () => {
                if (!client) {
                    return;
                }

                const current = client;
                client = undefined;
                await current.close();
            },
        };
    }
}
