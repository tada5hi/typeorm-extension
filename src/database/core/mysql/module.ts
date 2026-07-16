import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    DialectRuntime,
    IDatabaseDialect,
} from '../type';
import {
    MYSQL_FOREIGN_KEY_CHECKS_OFF,
    MYSQL_FOREIGN_KEY_CHECKS_ON,
    buildMySQLCreateDatabaseQuery,
    buildMySQLDropDatabaseQuery,
} from './statements';

/**
 * Serves mysql AND mariadb.
 */
export class MySQLDialect implements IDatabaseDialect {
    async create(operation: DatabaseCreateOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.server.connect(operation.initialDatabase);

        try {
            return await session.execute(
                buildMySQLCreateDatabaseQuery(operation.params, operation.ifNotExist),
            );
        } finally {
            await session.close();
        }
    }

    async drop(operation: DatabaseDropOperation, runtime: DialectRuntime): Promise<unknown> {
        const session = await runtime.server.connect(operation.initialDatabase);

        try {
            await session.execute(MYSQL_FOREIGN_KEY_CHECKS_OFF);

            try {
                return await session.execute(
                    buildMySQLDropDatabaseQuery(operation.params.database as string, operation.ifExist),
                );
            } finally {
                await session.execute(MYSQL_FOREIGN_KEY_CHECKS_ON);
            }
        } finally {
            await session.close();
        }
    }
}
