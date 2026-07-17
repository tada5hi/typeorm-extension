import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
    IDatabaseDialect,
} from '../type';
import {
    buildCockroachDBCreateDatabaseQuery,
    buildCockroachDBDropDatabaseQuery,
} from './statements';

export class CockroachDBDialect implements IDatabaseDialect {
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildCockroachDBCreateDatabaseQuery(
                    operation.params.database as string,
                    operation.ifNotExist,
                ),
            );
        } finally {
            await connection.close();
        }
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildCockroachDBDropDatabaseQuery(
                    operation.params.database as string,
                    operation.ifExist,
                ),
            );
        } finally {
            await connection.close();
        }
    }
}
