import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';
import {
    buildCockroachDBCreateDatabaseQuery,
    buildCockroachDBDropDatabaseQuery,
} from './statements';

export class CockroachDBDialect implements IDatabaseDialect {
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.connector.connect(operation.initialDatabase);

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

    async drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.connector.connect(operation.initialDatabase);

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
