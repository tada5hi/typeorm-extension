import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnector,
    IDatabaseDialect,
} from '../type';
import { hasResultRows } from '../utils';
import {
    buildPostgresCreateDatabaseQuery,
    buildPostgresCreateSchemaQuery,
    buildPostgresDatabaseExistsQuery,
    buildPostgresDropDatabaseQuery,
} from './statements';

export class PostgresDialect implements IDatabaseDialect {
    constructor(protected connector: IDatabaseConnector) {
        this.connector = connector;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const { params } = operation;

        const session = await this.connector.connect(operation.initialDatabase);

        let exists = false;
        let result: unknown;

        try {
            if (operation.ifNotExist) {
                const existsResult = await session.execute(
                    buildPostgresDatabaseExistsQuery(params.database as string),
                );

                exists = hasResultRows(existsResult);
            }

            if (!exists) {
                result = await session.execute(buildPostgresCreateDatabaseQuery(params));
            }
        } finally {
            await session.close();
        }

        if (exists) {
            return undefined;
        }

        /**
         * CREATE DATABASE cannot run in a transaction, and the schema lives
         * inside the new database — hence a second session, targeted at it.
         */
        if (typeof params.schema === 'string' && params.schema !== 'public') {
            const schemaSession = await this.connector.connect(params.database);

            try {
                await schemaSession.execute(buildPostgresCreateSchemaQuery(params.schema));
            } finally {
                await schemaSession.close();
            }
        }

        return result;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const session = await this.connector.connect(operation.initialDatabase);

        try {
            return await session.execute(
                buildPostgresDropDatabaseQuery(operation.params.database as string, operation.ifExist),
            );
        } finally {
            await session.close();
        }
    }
}
