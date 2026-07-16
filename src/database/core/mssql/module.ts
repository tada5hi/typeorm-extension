import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';
import {
    buildMsSQLCreateDatabaseQuery,
    buildMsSQLDropDatabaseQuery,
} from './statements';

export class MsSQLDialect implements IDatabaseDialect {
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.server.connect(operation.initialDatabase);

        try {
            return await session.execute(
                buildMsSQLCreateDatabaseQuery(operation.params, operation.ifNotExist),
            );
        } finally {
            await session.close();
        }
    }

    async drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.server.connect(operation.initialDatabase);

        try {
            return await session.execute(
                buildMsSQLDropDatabaseQuery(operation.params.database as string, operation.ifExist),
            );
        } finally {
            await session.close();
        }
    }
}
