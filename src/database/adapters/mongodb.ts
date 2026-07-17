import type { DataSourceOptions } from 'typeorm';
import type { MongoDriver } from 'typeorm/driver/mongodb/MongoDriver';
import { DriverError } from '../../errors';
import type {
    ConnectionParams,
    IDatabaseConnector,
    IDatabaseSession,
} from '../core';
import { buildMongoDBConnectionUri } from '../core';
import { useNativeDriver } from './typeorm-driver';

export class MongoDBConnector implements IDatabaseConnector {
    constructor(
        protected options: DataSourceOptions,
        protected params: ConnectionParams,
    ) {
        this.options = options;
        this.params = params;
    }

    session(database?: string): IDatabaseSession {
        const { options, params } = this;

        const uri = buildMongoDBConnectionUri(params, database);

        let client: any;
        let openPromise: Promise<void> | undefined;
        let closed = false;

        const open = () => {
            if (closed) {
                return Promise.reject(DriverError.sessionClosed());
            }

            if (!openPromise) {
                openPromise = (async () => {
                    const driver = useNativeDriver(options) as MongoDriver;
                    const { MongoClient } = driver.mongodb;

                    client = new MongoClient(uri, params.extra);
                    await client.connect();
                })();
            }

            return openPromise;
        };

        return {
            open,
            /**
             * Statements are JSON encoded command documents,
             * e.g. '{"dropDatabase": 1}'.
             */
            execute: async (statement: string) => {
                await open();

                return client.db().command(JSON.parse(statement));
            },
            close: async () => {
                if (closed) {
                    return;
                }

                closed = true;

                if (openPromise) {
                    try {
                        await openPromise;
                    } catch {
                        // opening failed — nothing to close
                    }
                }

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
