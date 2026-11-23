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
    const [last] = await executor.getExecutedMigrations();

    if (!last) {
        return undefined;
    }

    const { baseline } = source;

    if (baseline && (last.name === baseline.name || last.timestamp <= baseline.timestamp)) {
        throw MigrationPlanError.baselineIrreversible(baseline.name);
    }

    const target = [...source.current, ...(source.legacy ?? [])].find((item) => item.name === last.name);

    if (!target) {
        throw new TypeORMError(
            `No migration ${last.name} was found in the source code. Make sure you have this migration in your codebase and its included in the connection options.`,
        );
    }

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
 */
export async function undoDatabaseMigration(
    dataSource: DataSource,
    options: MigrationUndoOptions = {},
): Promise<Migration | undefined> {
    return withMigrationRunner(dataSource, options, (queryRunner) => execute(dataSource, queryRunner, options));
}
