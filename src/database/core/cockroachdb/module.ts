import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnector,
    IDatabaseDialect,
} from '../type';
import {
    buildCockroachDBCreateDatabaseQuery,
    buildCockroachDBDropDatabaseQuery,
} from './statements';

export class CockroachDBDialect implements IDatabaseDialect {
    constructor(protected connector: IDatabaseConnector) {
        this.connector = connector;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const session = this.connector.session(operation.initialDatabase);
        await session.open();

        try {
            return await session.execute(
                buildCockroachDBCreateDatabaseQuery(
                    operation.params.database as string,
                    operation.ifNotExist,
                ),
            );
        } finally {
            await session.close();
        }
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const session = this.connector.session(operation.initialDatabase);
        await session.open();

        try {
            return await session.execute(
                buildCockroachDBDropDatabaseQuery(
                    operation.params.database as string,
                    operation.ifExist,
                ),
            );
        } finally {
            await session.close();
        }
    }
}
