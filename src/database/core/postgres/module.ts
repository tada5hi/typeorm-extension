import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
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
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const { params } = operation;

        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        let exists = false;
        let result: unknown;

        try {
            if (operation.ifNotExist) {
                const existsResult = await connection.execute(
                    buildPostgresDatabaseExistsQuery(params.database as string),
                );

                exists = hasResultRows(existsResult);
            }

            if (!exists) {
                result = await connection.execute(buildPostgresCreateDatabaseQuery(params));
            }
        } finally {
            await connection.close();
        }

        if (exists) {
            return undefined;
        }

        /**
         * CREATE DATABASE cannot run in a transaction, and the schema lives
         * inside the new database — hence a second connection, targeted at it.
         */
        if (typeof params.schema === 'string' && params.schema !== 'public') {
            const schemaConnection = this.connectionFactory.create(params.database);
            await schemaConnection.open();

            try {
                await schemaConnection.execute(buildPostgresCreateSchemaQuery(params.schema));
            } finally {
                await schemaConnection.close();
            }
        }

        return result;
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildPostgresDropDatabaseQuery(operation.params.database as string, operation.ifExist),
            );
        } finally {
            await connection.close();
        }
    }
}
