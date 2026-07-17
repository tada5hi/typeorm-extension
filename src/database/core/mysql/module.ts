import type {
    DatabaseCreateOperation,
    DatabaseDropOperation,
    IDatabaseConnectionFactory,
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
    constructor(protected connectionFactory: IDatabaseConnectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    async create(operation: DatabaseCreateOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            return await connection.execute(
                buildMySQLCreateDatabaseQuery(operation.params, operation.ifNotExist),
            );
        } finally {
            await connection.close();
        }
    }

    async drop(operation: DatabaseDropOperation): Promise<unknown> {
        const connection = this.connectionFactory.create(operation.initialDatabase);
        await connection.open();

        try {
            await connection.execute(MYSQL_FOREIGN_KEY_CHECKS_OFF);

            try {
                return await connection.execute(
                    buildMySQLDropDatabaseQuery(operation.params.database as string, operation.ifExist),
                );
            } finally {
                await connection.execute(MYSQL_FOREIGN_KEY_CHECKS_ON);
            }
        } finally {
            await connection.close();
        }
    }
}
