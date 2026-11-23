import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { TypeORMError } from 'typeorm';
import { MigrationPlanError } from '../../../errors';
import { RunMigrationExecutor, withMigrationRunner } from './execution';
import { scanMigrationSource } from './source';
import type { MigrationUndoOptions } from './types';

async function execute(
    dataSource: DataSource,
    queryRunner: QueryRunner,
    options: MigrationUndoOptions,
): Promise<Migration | undefined> {
    const source = await scanMigrationSource(dataSource, options);
    const executor = new RunMigrationExecutor(dataSource, queryRunner);

    // newest first, by id; a missing table reads as empty and is not created
    const executed = await executor.getExecutedMigrations();
    const [last] = executed;
    const { logger } = dataSource;

    // The messages mirror typeorm's undoLastMigration.
    if (!last) {
        logger.logSchemaBuild('No migrations were found in the database. Nothing to revert!');

        return undefined;
    }

    const { baseline } = source;

    if (baseline && (last.name === baseline.name || last.timestamp <= baseline.timestamp)) {
        throw MigrationPlanError.baselineIrreversible(baseline.name);
    }

    // a row of the legacy chain is older than the baseline and refused above
    const target = source.current.find((item) => item.name === last.name);

    if (!target) {
        throw new TypeORMError(
            `No migration ${last.name} was found in the source code. Make sure you have this migration in your codebase and its included in the connection options.`,
        );
    }

    logger.logSchemaBuild(`${executed.length} migrations are already loaded in the database.`);
    logger.logSchemaBuild(`${last.name} is the last executed migration. It was executed on ${new Date(last.timestamp).toString()}.`);
    logger.logSchemaBuild('Now reverting it...');

    // Mirrors typeorm's undoLastMigration: the mode is the option or 'all', never the data source's.
    const mode = options.transaction ?? 'all';
    let started = false;

    if (mode !== 'none' && !queryRunner.isTransactionActive) {
        await queryRunner.startTransaction();
        started = true;
    }

    try {
        await queryRunner.beforeMigration();
        await target.instance?.down(queryRunner);
        await queryRunner.afterMigration();
        await executor.deleteMigration(last);

        logger.logSchemaBuild(`Migration ${target.name} has been reverted successfully.`);

        if (started) {
            await queryRunner.commitTransaction();
        }
    } catch (e) {
        if (started) {
            try {
                await queryRunner.rollbackTransaction();
            } catch {
                // the original error matters more
            }
        }

        throw e;
    }

    return target;
}

/**
 * Revert the newest executed migration, never one the baseline replaces or the baseline itself.
 *
 * @returns the reverted migration, or undefined when nothing is executed.
 *
 * @experimental The migration runner API may change in a minor release.
 */
export async function undoDatabaseMigration(
    dataSource: DataSource,
    options: MigrationUndoOptions = {},
): Promise<Migration | undefined> {
    return withMigrationRunner(dataSource, options, (queryRunner) => execute(dataSource, queryRunner, options));
}
