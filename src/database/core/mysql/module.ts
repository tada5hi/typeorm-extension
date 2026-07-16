import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnector,
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
    constructor(protected connector: IDatabaseConnector) {
        this.connector = connector;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const session = this.connector.session(operation.initialDatabase);
        await session.open();

        try {
            return await session.execute(
                buildMySQLCreateDatabaseQuery(operation.params, operation.ifNotExist),
            );
        } finally {
            await session.close();
        }
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const session = this.connector.session(operation.initialDatabase);
        await session.open();

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
