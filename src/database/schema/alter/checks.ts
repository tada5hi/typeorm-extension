import type { QueryRunner } from 'typeorm';
import {
    MYSQL_FOREIGN_KEY_CHECKS_OFF,
    MYSQL_FOREIGN_KEY_CHECKS_ON,
    MYSQL_FOREIGN_KEY_CHECKS_SELECT,
} from '../../core';
import { hasForeignKeyChecks } from './dialect';
import { isForeignKeyChecksEnabled } from './utils';

/**
 * Run a callback with the mysql/mariadb foreign key checks disabled and restore
 * the previous state afterwards (nesting safe). A no-op wrapper on every other
 * driver, so a migration using it stays portable.
 *
 * Re-adding a constraint which was already enforcing does not need to be
 * re-validated — the check only buys a full table scan, plus a failure mode for
 * rows some past import inserted with the checks off.
 */
export async function withForeignKeyChecksDisabled<T>(
    queryRunner: QueryRunner,
    fn: () => Promise<T>,
) : Promise<T> {
    if (!hasForeignKeyChecks(queryRunner.dataSource.options.type)) {
        return fn();
    }

    const enabled = isForeignKeyChecksEnabled(
        await queryRunner.query(MYSQL_FOREIGN_KEY_CHECKS_SELECT),
    );

    await queryRunner.query(MYSQL_FOREIGN_KEY_CHECKS_OFF);

    try {
        return await fn();
    } finally {
        if (enabled) {
            await queryRunner.query(MYSQL_FOREIGN_KEY_CHECKS_ON);
        }
    }
}
