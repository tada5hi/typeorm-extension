import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
    IDatabaseDialect,
} from '../type';
import {
    buildMsSQLCreateDatabaseQuery,
    buildMsSQLDropDatabaseQuery,
} from './statements';

export class MsSQLDialect implements IDatabaseDialect {
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildMsSQLCreateDatabaseQuery(operation.params, operation.ifNotExist),
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
                buildMsSQLDropDatabaseQuery(operation.params.database as string, operation.ifExist),
            );
        } finally {
            await connection.close();
        }
    }
}
